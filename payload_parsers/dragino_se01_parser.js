/* This is a default example for payload parser.
** The ignore_vars variable in this code should be used to ignore variables
** from the device that you don't want.
**
** Testing:
** You can do manual tests to this parse by using the Device Emulator. Copy and Paste the following code:
** [{ "variable": "payload", "value": "0109611395" }]
**
*/
 
const fport = payload.find(x => x.variable === 'fport');
 
var port;
 
if (fport)
  port = fport.value;
 
function parsePayload(payload) {
  try {
        //var dataToPush =[]; //needed for TagoIO
        var bytes = Buffer.from(payload, 'hex');  
        var data = [];
        var value;
        var decode = {};
        var mod;
       
 
        if(port==0x02){
 
          var mod=(bytes[10]>>7)&0x01;
          decode.BatV=((bytes[0]<<8 | bytes[1]) & 0x3FFF)/1000;//Battery,units:V
 
          var value=bytes[2]<<8 | bytes[3];
          if(bytes[2] & 0x80)
          {value |= 0xFFFF0000;}
          decode.temp_DS18B20=(value/10).toFixed(2);//DS18B20,temperature
         
          if(mod===0) {
          value=bytes[6]<<8 | bytes[7];
          var temp_SOIL;
          if((value & 0x8000)>>15 === 0)
            decode.temp_SOIL=(value/100).toFixed(2);//temp_SOIL,temperature
          else if((value & 0x8000)>>15 === 1)
            decode.temp_SOIL=((value-0xFFFF)/100).toFixed(2);
 
            data.push({ variable: 'temp_soil',  value: parseFloat(decode.temp_SOIL), unit: '°C'});
 
            decode.water_SOIL=((bytes[4]<<8 | bytes[5])/100).toFixed(2);//water_SOIL,Humidity,units:%
            data.push({ variable: 'soil_moisture',  value: parseFloat(decode.water_SOIL), unit: '%'});
            decode.conduct_SOIL=bytes[8]<<8 | bytes[9];
            data.push({ variable: 'conduct_soil',  value: parseFloat(decode.conduct_SOIL), unit: 'μS/cm'});
            }
          else
          {
            decode.Soil_dielectric_constant=((bytes[4]<<8 | bytes[5])/10).toFixed(1);
            decode.Raw_water_SOIL=bytes[6]<<8 | bytes[7];
            decode.Raw_conduct_SOIL=bytes[8]<<8 | bytes[9];
          }
          decode.s_flag = (bytes[10]>>4)&0x01;
          decode.i_flag = bytes[10]&0x0F;
          decode.Mod=mod
 
          console.log(decode);
          return data;
        }
       
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
const ignore_vars = ['customerdxprofileid','customerrealmid','rf_chain', 'channel', 'modulation', 'app_id', 'dev_id', 'gtw_trusted', 'port','classb','delayed','encodingtype','fcntdown','fcntup','gwrecvtime','recvtime','application_id', 'device_id', 'downlink_key', 'lora_bandwidth','lora_spreading_factor', 'coding_rate', 'frequency', 'timestamp','time','fport','fcnt','payload','gateway_eui','rssi','snr','frm_payload','lora_coding_rate','deveui','fcntdn','adrbit','mtype','mic_hex','lrcid','lrrrssi','lrrsnr','lrresp','spfact','subband','lrrid','late','devlrrcnt','BaseStationData','modelcfg','DriverCfg','txpower','nbtrans','downlinkurl','margin','batterytime','batterylevel','lostuplinksas','lrrlat','lrrlon','maxwaitasresps','payloadencryption'];
 
// Remove unwanted variables.
payload = payload.filter(x => !ignore_vars.includes(x.variable));
 
function Str1(str2){
  var str3 ="";
  for (var i=0;i<str2.length;i++){
    if (str2[i]<=0x0f){
     str2[i]="0"+str2[i].toString(16)+"";
    }
  str3+= str2[i].toString(16)+"";}
  return str3;
}
function str_pad(byte){
    var zero = '00';
    var hex= byte.toString(16);    
    var tmp  = 2-hex.length;
    return zero.substr(0,tmp) + hex + " ";
}
 
 
function datalog(i,bytes){
  var bb= parseFloat(((bytes[0+i]<<24>>16 | bytes[1+i])/100).toFixed(2));
  var cc= parseFloat(((bytes[2+i]<<24>>16 | bytes[3+i])/100).toFixed(2));
  var dd= parseFloat((((bytes[4+i]<<8 | bytes[5+i])&0xFFF)/10).toFixed(1));
 
  var ee= getMyDate((bytes[7+i]<<24 | bytes[8+i]<<16 | bytes[9+i]<<8 | bytes[10+i]).toString(10));
  var string='['+bb+','+cc+','+dd+','+ee+']'+',';  
 
  return string;
}
 
function getzf(c_num){
  if(parseInt(c_num) < 10)
    c_num = '0' + c_num;
 
  return c_num;
}
 
function getMyDate(str){
  var c_Date;
  if(str > 9999999999)
     c_Date = new Date(parseInt(str));
  else
     c_Date = new Date(parseInt(str) * 1000);
 
  var c_Year = c_Date.getFullYear(),
  c_Month = c_Date.getMonth()+1,
  c_Day = c_Date.getDate(),
  c_Hour = c_Date.getHours(),
  c_Min = c_Date.getMinutes(),
  c_Sen = c_Date.getSeconds();
  var c_Time = c_Year +'-'+ getzf(c_Month) +'-'+ getzf(c_Day) +' '+ getzf(c_Hour) +':'+ getzf(c_Min) +':'+getzf(c_Sen);
 
  return c_Time;
}