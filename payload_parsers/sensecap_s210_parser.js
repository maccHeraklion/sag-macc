/* This is a default example for payload parser.
** The ignore_vars variable in this code should be used to ignore variables
** from the device that you don't want.
**
** Testing:
** You can do manual tests to this parse by using the Device Emulator. Copy and Paste the following code:
** [{ "variable": "payload", "value": "0109611395" }]
**
*/
function parsePayload(payload) {
  try {
    var data =[]; //needed for TagoIO
    var bytes = Buffer.from(payload, 'hex');

    var decoded = {};

    //console.log(bytes);

    //Please add below the decoding content of decodeUplink() function
    bytes = bytes2HexString(bytes)
    .toLocaleUpperCase()

    //console.log(bytes);

    let result = {
      'err': 0, 'payload': bytes, 'valid': true, messages: []
    }
    let splitArray = dataSplit(bytes)

    //console.log('here');



    // data decoder
    for (let i = 0; i < splitArray.length; i++) {
      let item = splitArray[i]
      let dataId = item.dataId
      let dataValue = item.dataValue
      let messages = dataIdAndDataValueJudge(dataId, dataValue)
      console.log(messages)
      for (let ii=0; ii<messages.length; ii++){

        if (messages[ii].type === "rain_gauge") {
          data.push({ variable: "rain_gauge",  value: messages[ii].measurementValue*5/60, unit: "mm" });
        }
        else if (messages[ii].type === "barometric_pressure") {
          data.push({ variable: "barometric_pressure_hpa",  value: (messages[ii].measurementValue+550)/100, unit: "hPa" });
        }
        else if (messages[ii].type === "wind_speed") {
          data.push({ variable: "wind_speed_kmh",  value: messages[ii].measurementValue*3.6, unit: "km/h" });
        }
        else if (messages[ii].type === "peak_wind_gust") {
          data.push({ variable: "peak_wind_gust_kmh",  value: messages[ii].measurementValue*3.6, unit: "km/h" });
        }
        else {
          data.push({ variable: messages[ii].type,  value: messages[ii].measurementValue, unit: messages[ii].unit });
        }
        //console.log(messages[ii].type, messages[ii].measurementValue);
      }
    }


    const rainAccum = data.find(x => x.variable === 'rain_accumulation');
    if (rainAccum) {
      // 4C present: rain_height = rain_accumulation, rain_gauge stays as derived 5-min mm
      rainAccum.variable = "rain_height_acc";
    } else {
      // 4C absent: existing behavior — rename rain_gauge to rain_height
      const rainGauge = data.find(x => x.variable === "rain_gauge");
      if (rainGauge) rainGauge.variable = "rain_height";
    }

    const temperature = data.find(x => x.variable === 'air_temperature');
    const humidity = data.find(x => x.variable === 'air_humidity');
    const wind_speed = data.find(x => x.variable === 'wind_speed_kmh');

    if (temperature && humidity) {
      data.push({ variable: "dew_point",  value: calculateDewPoint(temperature.value, humidity.value), unit: "°C" });
      data.push({ variable: "heat_index",  value: calculateHeatIndex(temperature.value, humidity.value), unit: "°C" });
      if (wind_speed) {
        data.push({ variable: "thw_indexC",  value: calculateTHWIndex(calculateHeatIndex(temperature.value, humidity.value), wind_speed.value), unit: "°C" });
        data.push({ variable: "wind_chill",  value: calculateWindChill(temperature.value, wind_speed.value), unit: "°C" });
      }
    }
    //console.log(data);

    return data;

  // Catch any parsing errors
  } catch (e) {
    console.log(e);
    // Return the variable parse_error for debugging.
    return [{ variable: 'parse_error', value: e.message }];
  }
}

const payload_raw = payload.find(x => x.variable === 'payload');
if (payload_raw) {
  // Get a unique serie for the incoming data.
  const { value, serie, time } = payload_raw;

  // Parse the output_status8_1 to JSON format (it comes in a String format)
  if (value) { // && fport.value == 85
    payload = payload.concat(parsePayload(value).map(x => ({ ...x, serie, time: x.time || time })));
  }
}

// Add ignorable variables in this array.
const ignore_vars = ['rf_chain', 'channel', 'modulation', 'app_id', 'dev_id', 'gtw_trusted', 'port','classb','delayed','encodingtype','fcntdown','fcntup','gwrecvtime','recvtime','application_id', 'device_id', 'downlink_key', 'lora_bandwidth','lora_spreading_factor', 'coding_rate', 'frequency', 'timestamp','time','fport','fcnt','payload','gateway_eui','rssi','snr','frm_payload','lora_coding_rate','deveui','fcntdn','adrbit','mtype','mic_hex','lrcid','lrrrssi','lrrsnr','lrresp','spfact','subband','lrrid','late','devlrrcnt','BaseStationData','modelcfg','DriverCfg','txpower','nbtrans','downlinkurl','margin','batterytime','batterylevel','points','lrrlon','lrrlat','lostuplinksas','payloadencryption'];

// Remove unwanted variables.
payload = payload.filter(x => !ignore_vars.includes(x.variable));

//Please add below the helping functions
/**
 * data splits
 * @param bytes
 * @returns {*[]}
 */
function dataSplit (bytes) {
  let frameArray = []

  for (let i = 0; i < bytes.length; i++) {
    let remainingValue = bytes
    //console.log(remainingValue);
    let dataId = remainingValue.substring(0, 2)
    dataId = dataId.toLowerCase()
    let dataValue
    let dataObj = {}
    switch (dataId) {
      case '01' :
      case '20' :
      case '21' :
      case '30' :
      case '31' :
      case '33' :
      case '40' :
      case '41' :
      case '42' :
      case '43' :
      case '44' :
      case '45' :
        /*dataValue = remainingValue.substring(2, 22)
        bytes = remainingValue.substring(22)
        dataObj = {
          'dataId': dataId, 'dataValue': dataValue
        }
        break*/
      case '4a' :
        dataValue = remainingValue.substring(2, 22)
        bytes = remainingValue.substring(22)
        dataObj = {
          'dataId': dataId, 'dataValue': dataValue
        }
        break
      case '02':
        /*dataValue = remainingValue.substring(2, 18)
        bytes = remainingValue.substring(18)
        dataObj = {
          'dataId': '02', 'dataValue': dataValue
        }
        break*/
      case '4b':
        dataValue = remainingValue.substring(2, 18)
        bytes = remainingValue.substring(18)
        dataObj = {
          'dataId': dataId, 'dataValue': dataValue
        }
        break
      case '03' :
      case '06':
        dataValue = remainingValue.substring(2, 4)
        bytes = remainingValue.substring(4)
        dataObj = {
          'dataId': dataId, 'dataValue': dataValue
        }
        break
      case '05' :
      case '34':
        dataValue = bytes.substring(2, 10)
        bytes = remainingValue.substring(10)
        dataObj = {
          'dataId': dataId, 'dataValue': dataValue
        }
        break
      case '04':
      case '10':
      case '32':
      case '35':
      case '36':
      case '37':
      case '38':
      case '39':
        dataValue = bytes.substring(2, 20)
        bytes = remainingValue.substring(20)
        dataObj = {
          'dataId': dataId, 'dataValue': dataValue
        }
        break
      case '4c':
        dataValue = bytes.substring(2, 14)
        bytes = remainingValue.substring(14)
        dataObj = {
          'dataId': dataId, 'dataValue': dataValue
        }
        break
      default:
        dataValue = '9'
        break
    }
    if (dataValue.length < 2) {
      break
    }
    frameArray.push(dataObj)
  }
  return frameArray
}

function dataIdAndDataValueJudge (dataId, dataValue) {
  let messages = []
  let temperature
  let humidity
  let illumination
  let uv
  let windSpeed
  let windDirection
  let rainfall
  let airPressure
  let peakWind
  let rainAccumulation
  switch (dataId) {
    case '01':
      temperature = dataValue.substring(0, 4)
      humidity = dataValue.substring(4, 6)
      illumination = dataValue.substring(6, 14)
      uv = dataValue.substring(14, 16)
      windSpeed = dataValue.substring(16, 20)
      messages = [{
        measurementValue: loraWANV2DataFormat(temperature, 10), measurementId: '4097', type: 'air_temperature', unit: '°C'
      }, {
        measurementValue: loraWANV2DataFormat(humidity), measurementId: '4098', type: 'air_humidity', unit: '%'
      }, {
        measurementValue: loraWANV2DataFormat(illumination), measurementId: '4099', type: 'light_intensity', unit: 'lux'
      }, {
        measurementValue: loraWANV2DataFormat(uv, 10), measurementId: '4190', type: 'uv_index', unit: ''
      }, {
        measurementValue: loraWANV2DataFormat(windSpeed, 10), measurementId: '4105', type: 'wind_speed', unit: 'm/s'
      }]
      break
    case '02':
      windDirection = dataValue.substring(0, 4)
      rainfall = dataValue.substring(4, 12)
      airPressure = dataValue.substring(12, 16)
      messages = [{
        measurementValue: loraWANV2DataFormat(windDirection), measurementId: '4104', type: 'wind_direction_sensor', unit: '°'
      }, {
        measurementValue: loraWANV2DataFormat(rainfall, 1000), measurementId: '4113', type: 'rain_gauge', unit: 'mm'
      }, {

        measurementValue: loraWANV2DataFormat(airPressure, 0.1), measurementId: '4101', type: 'barometric_pressure', unit: 'Pa'
      }]
      break
    case '03':
      let Electricity = dataValue
      messages = [{
        measurementValue: loraWANV2DataFormat(Electricity), type: 'battery', unit: '%'
        //'Battery(%)': loraWANV2DataFormat(Electricity)
      }]
      break
    case '04':
      let electricityWhether = dataValue.substring(0, 2)
      let hwv = dataValue.substring(2, 6)
      let bdv = dataValue.substring(6, 10)
      let sensorAcquisitionInterval = dataValue.substring(10, 14)
      let gpsAcquisitionInterval = dataValue.substring(14, 18)
      messages = [{
        measurementValue: loraWANV2DataFormat(electricityWhether), type: 'battery', unit: '%'
      }, {
        measurementValue: `${loraWANV2DataFormat(hwv.substring(0, 2))}.${loraWANV2DataFormat(hwv.substring(2, 4))}`, type: "hardware_version", unit: ""
      }, {
        measurementValue: `${loraWANV2DataFormat(bdv.substring(0, 2))}.${loraWANV2DataFormat(bdv.substring(2, 4))}`, type: "firmware_version", unit: ""
      }]
      break
    case '05':
      let sensorAcquisitionIntervalFive = dataValue.substring(0, 4)
      let gpsAcquisitionIntervalFive = dataValue.substring(4, 8)
      messages = [{
        measurementValue: parseInt(loraWANV2DataFormat(sensorAcquisitionIntervalFive)) * 60, type: 'measure_interval', unit: ''
        //'measureInterval': parseInt(loraWANV2DataFormat(sensorAcquisitionIntervalFive)) * 60,
        //'gpsInterval': parseInt(loraWANV2DataFormat(gpsAcquisitionIntervalFive)) * 60
      }]
      break
    case '06':
      let errorCode = dataValue
      let descZh
      switch (errorCode) {
        case '00':
          descZh = 'CCL_SENSOR_ERROR_NONE'
          break
        case '01':
          descZh = 'CCL_SENSOR_NOT_FOUND'
          break
        case '02':
          descZh = 'CCL_SENSOR_WAKEUP_ERROR'
          break
        case '03':
          descZh = 'CCL_SENSOR_NOT_RESPONSE'
          break
        case '04':
          descZh = 'CCL_SENSOR_DATA_EMPTY'
          break
        case '05':
          descZh = 'CCL_SENSOR_DATA_HEAD_ERROR'
          break
        case '06':
          descZh = 'CCL_SENSOR_DATA_CRC_ERROR'
          break
        case '07':
          descZh = 'CCL_SENSOR_DATA_B1_NO_VALID'
          break
        case '08':
          descZh = 'CCL_SENSOR_DATA_B2_NO_VALID'
          break
        case '09':
          descZh = 'CCL_SENSOR_RANDOM_NOT_MATCH'
          break
        case '0A':
          descZh = 'CCL_SENSOR_PUBKEY_SIGN_VERIFY_FAILED'
          break
        case '0B':
          descZh = 'CCL_SENSOR_DATA_SIGN_VERIFY_FAILED'
          break
        case '0C':
          descZh = 'CCL_SENSOR_DATA_VALUE_HI'
          break
        case '0D':
          descZh = 'CCL_SENSOR_DATA_VALUE_LOW'
          break
        case '0E':
          descZh = 'CCL_SENSOR_DATA_VALUE_MISSED'
          break
        case '0F':
          descZh = 'CCL_SENSOR_ARG_INVAILD'
          break
        case '10':
          descZh = 'CCL_SENSOR_RS485_MASTER_BUSY'
          break
        case '11':
          descZh = 'CCL_SENSOR_RS485_REV_DATA_ERROR'
          break
        case '12':
          descZh = 'CCL_SENSOR_RS485_REG_MISSED'
          break
        case '13':
          descZh = 'CCL_SENSOR_RS485_FUN_EXE_ERROR'
          break
        case '14':
          descZh = 'CCL_SENSOR_RS485_WRITE_STRATEGY_ERROR'
          break
        case '15':
          descZh = 'CCL_SENSOR_CONFIG_ERROR'
          break
        case 'FF':
          descZh = 'CCL_SENSOR_DATA_ERROR_UNKONW'
          break
        default:
          descZh = 'CC_OTHER_FAILED'
          break
      }
      messages = [{
        measurementId: '4101', type: 'sensor_error_event', errCode: errorCode, descZh
      }]
      break
    case '10':
      let statusValue = dataValue.substring(0, 2)
      let { status, type } = loraWANV2BitDataFormat(statusValue)
      let sensecapId = dataValue.substring(2)
      messages = [{
        status: status, channelType: type, sensorEui: sensecapId
      }]
      break
    case '4a':
      temperature = dataValue.substring(0, 4)
      humidity = dataValue.substring(4, 6)
      illumination = dataValue.substring(6, 14)
      uv = dataValue.substring(14, 16)
      windSpeed = dataValue.substring(16, 20)
      messages = [{
        measurementValue: loraWANV2DataFormat(temperature, 10), measurementId: '4097', type: 'air_temperature', unit: '°C'
      }, {
        measurementValue: loraWANV2DataFormat(humidity), measurementId: '4098', type: 'air_humidity', unit: '%'
      }, {
        measurementValue: loraWANV2DataFormat(illumination), measurementId: '4099', type: 'light_intensity', unit: 'lux'
      }, {
        measurementValue: loraWANV2DataFormat(uv, 10), measurementId: '4190', type: 'uv_index', unit: ''
      }, {
        measurementValue: loraWANV2DataFormat(windSpeed, 10), measurementId: '4105', type: 'wind_speed', unit: 'm/s'
      }]
      break
    case '4b':
      windDirection = dataValue.substring(0, 4)
      rainfall = dataValue.substring(4, 12)
      airPressure = dataValue.substring(12, 16)
      messages = [{
        measurementValue: loraWANV2DataFormat(windDirection), measurementId: '4104', type: 'wind_direction_sensor', unit: '°'
      }, {
        measurementValue: loraWANV2DataFormat(rainfall, 1000), measurementId: '4113', type: 'rain_gauge', unit: 'mm'
      }, {

        measurementValue: loraWANV2DataFormat(airPressure, 0.1), measurementId: '4101', type: 'barometric_pressure', unit: 'Pa'
      }]
      break
    case '4c':
      peakWind = dataValue.substring(0, 4)
      rainAccumulation = dataValue.substring(4, 12)
      messages = [{
        measurementValue: loraWANV2DataFormat(peakWind, 10), measurementId: '4191', type: 'peak_wind_gust', unit: 'm/s'
      }, {
        measurementValue: loraWANV2DataFormat(rainAccumulation, 1000), measurementId: '4213', type: 'rain_accumulation', unit: 'mm'
      }]
      break
    default:
      break
  }
  return messages
}

/**
 *
 * data formatting
 * @param str
 * @param divisor
 * @returns {string|number}
 */
function loraWANV2DataFormat (str, divisor = 1) {
  let strReverse = bigEndianTransform(str)
  let str2 = toBinary(strReverse)
  if (str2.substring(0, 1) === '1') {
    let arr = str2.split('')
    let reverseArr = arr.map((item) => {
      if (parseInt(item) === 1) {
        return 0
      } else {
        return 1
      }
    })
    str2 = parseInt(reverseArr.join(''), 2) + 1
    return '-' + str2 / divisor
  }
  return parseInt(str2, 2) / divisor
}

/**
 * Handling big-endian data formats
 * @param data
 * @returns {*[]}
 */
function bigEndianTransform (data) {
  let dataArray = []
  for (let i = 0; i < data.length; i += 2) {
    dataArray.push(data.substring(i, i + 2))
  }
  // array of hex
  return dataArray
}

/**
 * Convert to an 8-digit binary number with 0s in front of the number
 * @param arr
 * @returns {string}
 */
function toBinary (arr) {
  let binaryData = arr.map((item) => {
    let data = parseInt(item, 16)
      .toString(2)
    let dataLength = data.length
    if (data.length !== 8) {
      for (let i = 0; i < 8 - dataLength; i++) {
        data = `0` + data
      }
    }
    return data
  })
  let ret = binaryData.toString()
    .replace(/,/g, '')
  return ret
}

/**
 * sensor
 * @param str
 * @returns {{channel: number, type: number, status: number}}
 */
function loraWANV2BitDataFormat (str) {
  let strReverse = bigEndianTransform(str)
  let str2 = toBinary(strReverse)
  let channel = parseInt(str2.substring(0, 4), 2)
  let status = parseInt(str2.substring(4, 5), 2)
  let type = parseInt(str2.substring(5), 2)
  return { channel, status, type }
}

/**
 * channel info
 * @param str
 * @returns {{channelTwo: number, channelOne: number}}
 */
function loraWANV2ChannelBitFormat (str) {
  let strReverse = bigEndianTransform(str)
  let str2 = toBinary(strReverse)
  let one = parseInt(str2.substring(0, 4), 2)
  let two = parseInt(str2.substring(4, 8), 2)
  let resultInfo = {
    one: one, two: two
  }
  return resultInfo
}

/**
 * data log status bit
 * @param str
 * @returns {{total: number, level: number, isTH: number}}
 */
function loraWANV2DataLogBitFormat (str) {
  let strReverse = bigEndianTransform(str)
  let str2 = toBinary(strReverse)
  let isTH = parseInt(str2.substring(0, 1), 2)
  let total = parseInt(str2.substring(1, 5), 2)
  let left = parseInt(str2.substring(5), 2)
  let resultInfo = {
    isTH: isTH, total: total, left: left
  }
  return resultInfo
}

function bytes2HexString (arrBytes) {
  var str = ''
  for (var i = 0; i < arrBytes.length; i++) {
    var tmp
    var num = arrBytes[i]
    if (num < 0) {
      tmp = (255 + num + 1).toString(16)
    } else {
      tmp = num.toString(16)
    }
    if (tmp.length === 1) {
      tmp = '0' + tmp
    }
    str += tmp
  }
  return str
}

function calculateHeatIndex(tCelcius, rh) {
    const c1 = -42.379;
    const c2 = 2.04901523;
    const c3 = 10.14333127;
    const c4 = -0.22475541;
    const c5 = -6.83783 * 0.001;
    const c6 = -5.481717 * 0.01;
    const c7 = 1.22874 * 0.001;
    const c8 = 8.5282 * 0.0001;
    const c9 = -1.99 * 0.000001;

    // Convert received Temperature to Fahreneit
    const tFahrenheit = tCelcius * 1.8 + 32;

    // Calculate the Heat Index in Fahrenheit
    const hiFahrenheit = c1 +
        c2 * tFahrenheit +
        c3 * rh +
        c4 * tFahrenheit * rh +
        c5 * tFahrenheit * tFahrenheit +
        c6 * rh * rh +
        c7 * tFahrenheit * tFahrenheit * rh +
        c8 * tFahrenheit * rh * rh +
        c9 * tFahrenheit * tFahrenheit * rh * rh;

    // Convert calculated Heat Index to Celsius
    const hiCelsius = (hiFahrenheit - 32) * 5 / 9;

    return hiCelsius;
}

function calculateTHWIndex(heatIndex, windSpeed) {
    return heatIndex - (1.072 * windSpeed);
}

function calculateWindChill(temperature, windSpeed) {
    return 13.12 + 0.6215 * temperature - 11.37 * Math.pow(windSpeed, 0.16) + 0.3965 * temperature * Math.pow(windSpeed, 0.16);
}


function calculateDewPoint(temperature, humidity) {
    // Constants for the dew point calculation
    const a = 17.27;
    const b = 237.7;

    // Calculate intermediate values
    const alpha = ((a * temperature) / (b + temperature)) + Math.log(humidity / 100.0);

    // Calculate dew point in Celsius
    const dewPointCelsius = (b * alpha) / (a - alpha);

    // Convert dew point to Fahrenheit if needed
    const dewPointFahrenheit = (dewPointCelsius * 9/5) + 32;

    return dewPointCelsius.toFixed(2);
    /*return {
        dewPointCelsius: dewPointCelsius.toFixed(2),
        dewPointFahrenheit: dewPointFahrenheit.toFixed(2)
    };*/
}
