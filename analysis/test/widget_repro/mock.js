window.__S=[];window.__R=[];
var __impl={ready:function(){var w=window.__W;setTimeout(function(){window.__S.forEach(function(c){c(w)})},0)},onStart:function(c){window.__S.push(c)},onRealtime:function(c){window.__R.push(c)},onError:function(){},onSyncUserInformation:function(){},sendData:function(a,b){b&&b({status:true})},editData:function(){},deleteData:function(){},editResourceData:function(){},openLink:function(){},autoFill:true};
var __mock={};Object.keys(__impl).forEach(function(k){Object.defineProperty(__mock,k,{enumerable:true,get:function(){return __impl[k]},set:function(v){}})});
Object.defineProperty(window,"TagoIO",{configurable:false,get:function(){return __mock},set:function(v){}});
