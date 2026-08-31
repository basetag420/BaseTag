// ==UserScript==
// @name CnC TA RepairAll Override
// @namespace http://tampermonkey.net/
// @version 2025-10-09
// @description Prevents low level units from being repaired via Repair All buttons.
// @match https://*.alliances.commandandconquer.com/*/index.aspx*
// @icon https://www.google.com/s2/favicons?sz=64&domain=commandandconquer.com
// @grant none
// ==/UserScript==

(function () {
'use strict';

const MIN_REPAIR_LEVEL = 5;
let cnc, ClientLib, visMain, mainData;

function findKey(object, name) {
let keys = Object.getOwnPropertyNames(object);
for (let key of keys) {
if (key !== name && object[key] === object[name]) return key;
}
}

function init() {
try {
let _REPAIR_ = findKey(ClientLib.Data.CityRepair.prototype, 'RepairAll');
let fs = ClientLib.Data.CityRepair.prototype[_REPAIR_].toString();
let reRep = /(?:this)(?:(?!this).)*?"Repair"[^]*?!0\)/;
let rep = fs.match(reRep)[0];
rep = rep.replace('-1', 'f');
fs = fs.replace(reRep, '').replace(/(\(f in u\))(.+?)(;)/, `$1 if (u[f].m_oEntity.get_CurrentLevel() >= MIN_REPAIR_LEVEL || u[f].m_oEntity.get_HitpointsPercent() === 0) $2, ${rep}$3`);
ClientLib.Data.CityRepair.prototype[_REPAIR_] = eval('(' + fs + ')');
ClientLib.Data.CityRepair.prototype.RepairAll = ClientLib.Data.CityRepair.prototype[_REPAIR_];
console.log(`CnC TA RepairAll Override applied. Only units of level ${MIN_REPAIR_LEVEL}+ are now affected by RepairAll.`);
}
catch (e) {
console.error(`CnC TA RepairAll Override - failed to complete initialization: ${e}`);
alert('CnC TA RepairAll Override initialization failed, be careful!');
}
}

function wait(callback) {
cnc = window.webfrontend?.phe?.cnc;
ClientLib = window.ClientLib;
visMain = ClientLib?.Vis?.VisMain?.GetInstance();
mainData = ClientLib?.Data?.MainData?.GetInstance();
if (cnc && visMain && mainData) init();
else setTimeout(wait, 500);
}

wait();
})();