/* Dragino SPH01-LB — Soil pH & Temperature LoRaWAN Sensor
** Payload format (fport=2, 11 bytes):
**   [0-1]  Battery voltage: (bytes[0]<<8|bytes[1]) & 0x3FFF) / 1000  → V
**   [2-3]  DS18B20 external temperature × 10 (signed 16-bit)          → °C
**   [4-5]  Soil pH × 100 (unsigned 16-bit)                            → pH
**   [6-7]  Soil temperature × 10 (signed 16-bit)                      → °C
**   [8]    Interrupt flag
**   [10]   Message type
**
** Testing:
** [{ "variable": "payload", "value": "0CE801F401F4012C0100" }, { "variable": "fport", "value": 2 }]
*/

const fport = payload.find(x => x.variable === 'fport');

var port;
if (fport)
  port = fport.value;

function parsePayload(payload) {
  try {
    var bytes = Buffer.from(payload, 'hex');
    var data = [];
    var decode = {};

    if (port == 0x02) {
      decode.BatV = ((bytes[0] << 8 | bytes[1]) & 0x3FFF) / 1000; // Battery, V

      // DS18B20 external temperature — signed 16-bit, resolution 0.1 °C
      var value = bytes[2] << 8 | bytes[3];
      if (bytes[2] & 0x80) value |= 0xFFFF0000;
      decode.temp_DS18B20 = parseFloat((value / 10).toFixed(2));
      data.push({ variable: 'temp_DS18B20', value: decode.temp_DS18B20, unit: '°C' });

      // Soil pH — unsigned 16-bit, resolution 0.01
      decode.soil_ph = parseFloat(((bytes[4] << 8 | bytes[5]) / 100).toFixed(2));
      data.push({ variable: 'soil_ph', value: decode.soil_ph, unit: 'pH' });

      // Soil temperature — signed 16-bit, resolution 0.1 °C
      value = bytes[6] << 8 | bytes[7];
      if ((value & 0x8000) >> 15 === 1)
        decode.temp_SOIL = parseFloat(((value - 0x10000) / 10).toFixed(2)); // [CLEANFIX 2026-07-02] two's-complement -0x10000
      else
        decode.temp_SOIL = parseFloat((value / 10).toFixed(2));
      data.push({ variable: 'temp_soil', value: decode.temp_SOIL, unit: '°C' });

      decode.i_flag    = bytes[8];
      decode.mes_type  = bytes[10];

      console.log(decode);
      return data;
    }

  } catch (e) {
    console.log(e);
    return [{ variable: 'parse_error', value: e.message }];
  }
}

const payload_raw = payload.find(x => x.variable === 'payload');
if (payload_raw) {
  const { value, serie, time } = payload_raw;
  if (value) {
    payload = payload.concat(parsePayload(value).map(x => ({ ...x, serie, time: x.time || time })));
  }
}

// Add ignorable variables in this array.
const ignore_vars = ['rf_chain', 'channel', 'modulation', 'app_id', 'dev_id', 'gtw_trusted', 'port', 'classb', 'delayed', 'encodingtype', 'fcntdown', 'fcntup', 'gwrecvtime', 'recvtime', 'application_id', 'device_id', 'downlink_key', 'lora_bandwidth', 'lora_spreading_factor', 'coding_rate', 'frequency', 'timestamp', 'time', 'fport', 'fcnt', 'payload', 'gateway_eui', 'rssi', 'snr', 'frm_payload', 'lora_coding_rate', 'deveui', 'fcntdn', 'adrbit', 'mtype', 'mic_hex', 'lrcid', 'lrrrssi', 'lrrsnr', 'lrresp', 'spfact', 'subband', 'lrrid', 'late', 'devlrrcnt', 'BaseStationData', 'modelcfg', 'DriverCfg', 'txpower', 'nbtrans', 'downlinkurl', 'margin', 'batterytime', 'batterylevel', 'lostuplinksas', 'lrrlat', 'lrrlon', 'maxwaitasresps', 'payloadencryption'];

// Remove unwanted variables.
payload = payload.filter(x => !ignore_vars.includes(x.variable));
