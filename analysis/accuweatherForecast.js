const { Device, Analysis, Utils, Account } = require('@tago-io/sdk');
const axios = require('axios');

function tagoObj(objectItem, series, prefix = "") {
  return Object.entries(objectItem).map(([key, value]) => {
    if (typeof value === "object") {
      return {
        variable: (value.variable || `${prefix}${key}`).toLowerCase(),
        value: value.value,
        serie: value.serie || series,
        metadata: value.metadata,
        location: value.location,
        unit: value.unit,
      };
    } else {
      return {
        variable: `${prefix}${key}`.toLowerCase(),
        value: value,
        serie: series,
      };
    }
  });
}

async function getWeather({ id: cityId, city }, apiKey) {
  const url = `http://dataservice.accuweather.com/currentconditions/v1/${cityId}?apikey=${apiKey}&language=en-US&details=true`;
  try {
    const response = await axios.get(url);
    const weather = response.data[0];
    return { ...weather, city_id: cityId, city_name: city };
  } catch (error) {
    console.error(`Failed to fetch weather data for city ID ${cityId}:`, error.message);
    return null;
  }
}

async function getForecast({ id: cityId, city }, apiKey) {
  const url = `http://dataservice.accuweather.com/forecasts/v1/daily/5day/${cityId}?apikey=${apiKey}&language=en-US&details=true&metric=true`;
  try {
    const response = await axios.get(url);
    const forecast = response.data;
    return { ...forecast, city_id: cityId, city_name: city };
  } catch (error) {
    console.error(`Failed to fetch forecast data for city ID ${cityId}:`, error.message);
    return null;
  }
}

function getAttribute(dataJson = {}, param) {
  return param.split('.').reduce((acc, key) => (acc && acc[key] != null) ? acc[key] : null, dataJson);
}

async function myAnalysis(context) {
  context.log('Running');
  const environment = Utils.envToJson(context.environment);

  // Get the environment variables.
   var account_token;
   const my_account_token = context.environment.find(env_var => env_var.key === 'ACCOUNT_TOKEN');
   if (my_account_token) {
    account_token = my_account_token.value;
    // You can now use api_key in your script securely
   } else {
     return console.log('Account token not found!');
   }

   console.log(account_token)

   //  // Instance the Account class
   const account = new Account({ token: account_token }); 

   var weather_api_key;
   const my_weather_api_key = context.environment.find(env_var => env_var.key === 'ACCUWEATHER_API_KEY');
   if (my_weather_api_key) {
    weather_api_key = my_weather_api_key.value;
    // You can now use api_key in your script securely
   } else {
     return console.log('API Key not found!');
   }

   console.log(weather_api_key);

   // Constants
   const prefix = 'macc_';

   // You can remove the comments on line 51 and 57 to use the Tag Filter.
   const filter = { tags: [{ key: 'device_type', value: "accuweather" }]};
 
   const devices = await account.devices.list({
     page: 1,
     amount: 1000,
     fields: ["id", "name", "tags","last_input"],
     filter,
   });
 
   if (!devices.length) {
     return context.log(`No device found with given tags`);
   }
   else
    console.log(`${devices.length} Locations to get data!`)

    for (const [index, deviceObj] of devices.entries()) {
      // Get Device Class
      var device_token = await Utils.getTokenByName(account, deviceObj.id);
      var device = new Device({ token: device_token }); 

      // Read tags
      const alias = deviceObj.tags.find(tag => tag.key === prefix+'alias');
      if (alias)
        context.log(`Retrieving Forecast for ${alias.value}`);
      else
        context.log(`Retrieving Forecast for ${index}`);

      const city_id = deviceObj.tags.find(tag => tag.key === 'city_id');

      if (!city_id) {
        context.log(`No City ID found in tags`);
        continue;
      }     

      const cityList = [
        { id: city_id.value, city: 'N/A' },
        // Additional cities can be added here
      ];

      const weatherResults = await Promise.all(
        cityList.map(city => getWeather(city, weather_api_key))
      );

      //const weatherResults = await getWeather({ id: city_id.value, city: 'N/A' }, weather_api_key);

      const validWeatherResults = weatherResults.filter(Boolean);

      const weatherData = validWeatherResults.flatMap(weather => {
        return tagoObj({
          temperature: {
            value: getAttribute(weather, 'Temperature.Metric.Value'),
            unit: `°${getAttribute(weather, 'Temperature.Metric.Unit')}`,
            metadata: {
              city: weather.city_id,
              value: getAttribute(weather, 'Temperature.Imperial.Value'),
              unit: `°${getAttribute(weather, 'Temperature.Imperial.Unit')}`,
            },
          },
          wind_speed: {
            value: getAttribute(weather, 'Wind.Speed.Metric.Value'),
            unit: `${getAttribute(weather, 'Wind.Speed.Metric.Unit')}`,
            metadata: {
              city: weather.city_id,
              value: getAttribute(weather, 'Wind.Speed.Imperial.Value'),
              unit: `${getAttribute(weather, 'Wind.Speed.Imperial.Unit')}`,
            },
          },
          wind_direction: {
            value: getAttribute(weather, 'Wind.Direction.English'),
            metadata: {
              city: weather.city_id,
            },
          },
          pressure: {
            value: getAttribute(weather, 'Pressure.Metric.Value'),
            unit: `${getAttribute(weather, 'Pressure.Metric.Unit')}`,
            metadata: {
              city: weather.city_id,
              value: getAttribute(weather, 'Pressure.Imperial.Value'),
              unit: `${getAttribute(weather, 'Pressure.Imperial.Unit')}`,
            },
          },
          visibility: {
            value: getAttribute(weather, 'Visibility.Metric.Value'),
            unit: `${getAttribute(weather, 'Visibility.Metric.Unit')}`,
            metadata: {
              city: weather.city_id,
              value: getAttribute(weather, 'Visibility.Imperial.Value'),
              unit: `${getAttribute(weather, 'Visibility.Imperial.Unit')}`,
            },
          },
          humidity: {
            value: getAttribute(weather, 'RelativeHumidity'),
            unit: '%',
            metadata: {
              city: weather.city_id,
            },
          },
          feel_temperature: {
            value: getAttribute(weather, 'RealFeelTemperature.Metric.Value'),
            unit: `°${getAttribute(weather, 'RealFeelTemperature.Metric.Unit')}`,
            metadata: {
              city: weather.city_id,
              value: getAttribute(weather, 'RealFeelTemperature.Imperial.Value'),
              unit: `°${getAttribute(weather, 'RealFeelTemperature.Imperial.Unit')}`,
            },
          },
          precipitation: {
            value: getAttribute(weather, 'PrecipitationSummary.Precipitation.Metric.Value'),
            unit: `${getAttribute(weather, 'PrecipitationSummary.Precipitation.Metric.Unit')}`,
            metadata: {
              city: weather.city_id,
              value: getAttribute(weather, 'PrecipitationSummary.Precipitation.Imperial.Value'),
              unit: `${getAttribute(weather, 'PrecipitationSummary.Precipitation.Imperial.Unit')}`,
            },
          },
          cloud: {
            value: getAttribute(weather, 'WeatherText'),
            metadata: { city: weather.city_id },
          },
        });
      });

      const forecastResults = await Promise.all(
      cityList.map(city => getForecast(city, weather_api_key))
    );

    const validForecastResults = forecastResults.filter(Boolean);

    const forecastData = validForecastResults.flatMap(forecast => {
      return forecast.DailyForecasts.flatMap((day, index) => {
        const dayIndex = index + 1; // Start index from 1

        // Extract the date part from the datetime string
        const date = new Date(day.Date).toISOString().split('T')[0];

        const humidityValues = getAttribute(day, 'Day.RelativeHumidity');
        return [
          ...tagoObj({
            [`date${dayIndex}`]: {
              value: date,  // Only the date part
              metadata: { city: forecast.city_id }
            },
            [`min_temp${dayIndex}`]: {
              value: getAttribute(day, 'Temperature.Minimum.Value'),
              unit: `°${getAttribute(day, 'Temperature.Minimum.Unit')}`,
              metadata: { city: forecast.city_id }
            },
            [`max_temp${dayIndex}`]: {
              value: getAttribute(day, 'Temperature.Maximum.Value'),
              unit: `°${getAttribute(day, 'Temperature.Maximum.Unit')}`,
              metadata: { city: forecast.city_id }
            },
            [`day_icon${dayIndex}`]: {
              value: getAttribute(day, 'Day.Icon'),
              metadata: { city: forecast.city_id }
            },
            [`day${dayIndex}`]: {
              value: getAttribute(day, 'Day.IconPhrase'),
              metadata: { city: forecast.city_id }
            },
            [`night${dayIndex}`]: {
              value: getAttribute(day, 'Night.IconPhrase'),
              metadata: { city: forecast.city_id }
            },
            [`precipitation_day${dayIndex}`]: {
              value: getAttribute(day, 'Day.PrecipitationProbability'),
              unit: '%',
              metadata: { city: forecast.city_id }
            },
            [`precipitation_night${dayIndex}`]: {
              value: getAttribute(day, 'Night.PrecipitationProbability'),
              unit: '%',
              metadata: { city: forecast.city_id }
            },
            [`wind_speed${dayIndex}`]: {
              value: getAttribute(day, 'Day.Wind.Speed.Value'),
              unit: `${getAttribute(day, 'Day.Wind.Speed.Unit')}`,
              metadata: { city: forecast.city_id }
            },
            [`wind_direction${dayIndex}`]: {
              value: getAttribute(day, 'Day.Wind.Direction.Degrees'),
              unit: '°',
              metadata: { city: forecast.city_id }
            },
          }),
          { variable: `humidity_min${dayIndex}`, value: humidityValues.Minimum, unit: '%', metadata: { city: forecast.city_id }},
          { variable: `humidity_max${dayIndex}`, value: humidityValues.Maximum, unit: '%', metadata: { city: forecast.city_id }},
          // { variable: `humidity_avg${dayIndex}`, value: humidityValues.Average, unit: '%', metadata: { city: forecast.city_id }},
        ];
      });
    });

      try {
        await device.sendData(weatherData.concat(forecastData));
        context.log('Weather and forecast data sent successfully');
      } catch (error) {
        context.log('Failed to send weather and forecast data:', error.message || JSON.stringify(error));
        context.log('Weather data:', JSON.stringify(weatherData, null, 2));
        context.log('Forecast data:', JSON.stringify(forecastData, null, 2));
      }
    }  
}

/*async function runMyAnalysis(context, scope) {
  try {
    await myAnalysis(context, scope);
    context.log('End');
  } catch (error) {
    context.log('Error:', error.message || JSON.stringify(error));
  }
}*/

module.exports = new Analysis(myAnalysis);
