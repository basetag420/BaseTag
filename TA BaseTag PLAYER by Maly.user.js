// ==UserScript==
// @name         TA BaseTag PLAYER by Maly
// @namespace    Maly
// @version      1.32
// @description  Player BaseTag — auto-update, saved SIM black, quick local REMOVE
// @updateURL    https://raw.githubusercontent.com/basetag420/BaseTag/main/TA%20BaseTag%20PLAYER%20by%20Maly.user.js
// @downloadURL  https://raw.githubusercontent.com/basetag420/BaseTag/main/TA%20BaseTag%20PLAYER%20by%20Maly.user.js
// @match        https://*.alliances.commandandconquer.com/*/index.aspx*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      script.google.com
// @connect      script.googleusercontent.com
// @connect      raw.githubusercontent.com
// ==/UserScript==

(function () {
    "use strict";

    /*
     * HARD WORLD-ONLY START GATE
     * BaseTag does not initialize at all on the landing page / world selector.
     * No auth, no API, no qx/game hooks, no color patch, no Scripts entry.
     */
    const __baseTagWorldMatch =
        String(window.location.pathname || "")
            .match(/^\/(\d+)\/index\.aspx\/?$/i);

    if (!__baseTagWorldMatch) {
        return;
    }

    function pageMain(pageWindow, verifiedPassword, nativeGMRequest) {
        "use strict";

        // Work directly with the game page window. This avoids Firefox CSP blocking
        // inline <script> injection and avoids relying on sandbox-global qx/ClientLib.
        const window = pageWindow;
        const document = pageWindow.document;
        let qx = pageWindow.qx;
        let ClientLib = pageWindow.ClientLib;
        let webfrontend = pageWindow.webfrontend;

        // Use Tampermonkey/Greasemonkey's real request function directly.
        // pageMain is called from the userscript sandbox, so this stays available
        // even though qx/ClientLib are read from unsafeWindow.
        const GM_xmlhttpRequest = nativeGMRequest;
        if (typeof GM_xmlhttpRequest !== "function") {
            throw new Error("Native GM_xmlhttpRequest unavailable");
        }



            "use strict";

            const API_URL        = "https://script.google.com/macros/s/AKfycbw9CTsOcrzk_5LQ0TNsX9GWpuZf3vVuZA1MT2YArqD30MjQEjzFMTWWvmVBDpqGaCGI/exec";
            const ADMIN_KEY      = "ogunhand_secret_472";
            function getWorldNumber() {
                const m = String(pageWindow.location.pathname || "").match(/\/(\d+)\//);
                return m ? String(m[1]) : "unknown";
            }
            const FORCE_WORLD_ID = getWorldNumber();
            const STORAGE_KEY     = "AF_WAR_BOARD_V14";
            const SIM_STORAGE_KEY = "AF_WAR_BOARD_SIMS_V14";
            const MEMBER_STORAGE_KEY = "AF_WAR_BOARD_MEMBER_V1";
            const PASSWORD_STORAGE_KEY = "AF_WAR_BOARD_PASSWORD_V1";
            let accessPassword = String(verifiedPassword || "");
            let accessGranted = !!accessPassword;
            const ACTIONS    = ["KILL", "IGNORE"];
            const PRIORITIES = ["HIGH", "MED", "LOW"];

            let marks        = loadLocal(STORAGE_KEY);
            let mySimSaves   = loadLocal(SIM_STORAGE_KEY);

            // Native saved attack formations (the game's own SIM/save system).
            // O(1) lookup on the hot colour path; state is learned from the game's
            // own HasAttackFormation calls, plus one lazy scan per target if needed.
            const nativeSimByCity = Object.create(null);
            const nativeSimCounts = Object.create(null);
            const nativeSimKnownTargets = Object.create(null);

            function setNativeSimState(cityId, targetId, hasSim) {
                cityId = String(cityId);
                targetId = String(targetId);
                let cityMap = nativeSimByCity[cityId];
                if (!cityMap) cityMap = nativeSimByCity[cityId] = Object.create(null);

                const prev = cityMap[targetId] === true;
                const next = hasSim === true;
                if (prev === next) {
                    nativeSimKnownTargets[targetId] = true;
                    return;
                }

                cityMap[targetId] = next;
                let count = nativeSimCounts[targetId] || 0;
                count += next ? 1 : -1;
                if (count < 0) count = 0;
                nativeSimCounts[targetId] = count;
                nativeSimKnownTargets[targetId] = true;
            }

            function primeNativeSimTarget(targetId) {
                targetId = String(targetId || "");
                if (!targetId || nativeSimKnownTargets[targetId]) return;
                nativeSimKnownTargets[targetId] = true;

                try {
                    const all = ClientLib.Data.MainData.GetInstance().get_Cities().get_AllCities().d;
                    for (const cityId in all) {
                        const city = all[cityId];
                        if (!city) continue;

                        let fn = null;
                        if (typeof city.__AFWBv14HAFOrig === "function") fn = city.__AFWBv14HAFOrig;
                        else if (typeof city.HasAttackFormation === "function") fn = city.HasAttackFormation;
                        if (!fn) continue;

                        let nativeHas = false;
                        try { nativeHas = !!fn.call(city, targetId); } catch (e) {}
                        setNativeSimState(cityId, targetId, nativeHas);
                    }
                } catch (e) {}
            }

            function isNativeSimTarget(targetId) {
                targetId = String(targetId || "");
                if (!targetId) return false;
                if (!nativeSimKnownTargets[targetId]) primeNativeSimTarget(targetId);
                return (nativeSimCounts[targetId] || 0) > 0;
            }
            let memberMarks = loadLocal(MEMBER_STORAGE_KEY);
            let panel        = null;
            let scriptsAdded = false;
            let apiDown      = false;
            let syncInProgress = false;
            let myPlayerName = "";
            let shiftPending = [];
            let shiftPanel   = null;
            let lastPlayersHash = "";

            const BASETAG_LOCAL_VERSION = "1.32";
            const BASETAG_RAW_UPDATE_URL = "https://raw.githubusercontent.com/basetag420/BaseTag/main/TA%20BaseTag%20PLAYER%20by%20Maly.user.js";

            function compareVersions(a,b) {
                const aa=String(a||"0").split(".").map(function(x){return parseInt(x,10)||0;});
                const bb=String(b||"0").split(".").map(function(x){return parseInt(x,10)||0;});
                const n=Math.max(aa.length,bb.length);
                for(let i=0;i<n;i++){
                    const av=aa[i]||0,bv=bb[i]||0;
                    if(av>bv)return 1;
                    if(av<bv)return -1;
                }
                return 0;
            }

            function checkBaseTagUpdate(btn,statusLbl) {
                if(!nativeGMRequest){
                    try{statusLbl.setValue("Update check unavailable");statusLbl.setTextColor("#ef4444");}catch(e){}
                    return;
                }
                try{btn.setEnabled(false);btn.setLabel("Checking…");}catch(e){}
                nativeGMRequest({
                    method:"GET",
                    url:BASETAG_RAW_UPDATE_URL + "?t=" + Date.now(),
                    timeout:15000,
                    headers:{"Cache-Control":"no-cache"},
                    onload:function(r){
                        try{
                            const text=String(r.responseText||"");
                            if(Number(r.status)!==200) throw new Error("GitHub HTTP "+r.status);
                            const m=text.match(/^[ \t]*\/\/[ \t]*@version[ \t]+([^\s]+)[ \t]*$/mi);
                            if(!m) throw new Error("No @version in GitHub file");
                            const remote=String(m[1]).trim();
                            if(compareVersions(remote,BASETAG_LOCAL_VERSION)>0){
                                statusLbl.setValue("New v"+remote);
                                statusLbl.setTextColor("#22c55e");
                                btn.setLabel("UPDATE → v"+remote);
                                btn.setEnabled(true);
                                btn.__baseTagUpdateReady=true;
                                btn.__baseTagRemoteVersion=remote;
                            }else{
                                statusLbl.setValue("Up to date · v"+BASETAG_LOCAL_VERSION);
                                statusLbl.setTextColor("#64748b");
                                btn.setLabel("CHECK UPDATE");
                                btn.setEnabled(true);
                                btn.__baseTagUpdateReady=false;
                            }
                        }catch(e){
                            try{statusLbl.setValue("Update error: "+String(e.message||e));statusLbl.setTextColor("#ef4444");btn.setLabel("CHECK UPDATE");btn.setEnabled(true);}catch(ex){}
                        }
                    },
                    onerror:function(){try{statusLbl.setValue("GitHub unavailable");statusLbl.setTextColor("#ef4444");btn.setLabel("CHECK UPDATE");btn.setEnabled(true);}catch(e){}},
                    ontimeout:function(){try{statusLbl.setValue("Update timeout");statusLbl.setTextColor("#ef4444");btn.setLabel("CHECK UPDATE");btn.setEnabled(true);}catch(e){}}
                });
            }

            function wait() {
            try {
                qx = pageWindow.qx;
                ClientLib = pageWindow.ClientLib;
                webfrontend = pageWindow.webfrontend;

                if (
                    typeof qx === "undefined" ||
                    typeof ClientLib === "undefined" ||
                    typeof webfrontend === "undefined" ||
                    !qx.core.Init.getApplication() ||
                    !ClientLib.Data.MainData.GetInstance() ||
                    !ClientLib.Vis ||
                    !ClientLib.Vis.Region
                ) {
                    return setTimeout(wait, 1000);
                }

                const md = ClientLib.Data.MainData.GetInstance();

                if (
                    !md.get_Player() ||
                    !md.get_Player().get_Name()
                ) {
                    return setTimeout(wait, 1000);
                }

                init();

            } catch (e) {
                setTimeout(wait, 1000);
            }
        }

            function init() {
                if (window.AFWBv14Loaded) return;
                window.AFWBv14Loaded = true;
                myPlayerName = detectPlayerName();
        console.log("INIT PLAYER =", myPlayerName);

        setTimeout(function () {
            myPlayerName = detectPlayerName();
            console.log("PLAYER AFTER 5s =", myPlayerName);
        }, 5000);
                try { hookNativePlateColor(); } catch(e){ console.log(e); }
        try { hookRegionMenu(); } catch(e){ console.log(e); }
        try { hookShiftClick(); } catch(e){ console.log(e); }

        // Dodaj BaseTag do menu Scripts od razu po starcie.
        // Niezależny szybki retry usuwa zależność od minutowego syncu.
        try { addTopButton(); } catch(e){ console.log("[BaseTag v19] addTopButton init:", e); }
        const topButtonRetry = setInterval(function () {
            if (scriptsAdded) { clearInterval(topButtonRetry); return; }
            try { addTopButton(); } catch(e){ console.log("[BaseTag v19] addTopButton retry:", e); }
        }, 1000);

        try { syncFromServer(); } catch(e){ console.log(e); }
        // Odświeżanie znaczników co 15 s
        setInterval(function () {
            // Network check only. syncFromServer() redraws markers ONLY when data changed.
            syncFromServer();
        }, 60000); // co minutę

        // Nick approval replaced the old alliance-member allowlist sync.
        // PLAYER is read-only, so these legacy background calls are intentionally disabled.
                console.log("[BaseTag v14] Loaded. Player:", myPlayerName);
            }

            function detectPlayerName() {
                try {
                    const p = ClientLib.Data.MainData.GetInstance().get_Player();
                    if (p && typeof p.get_Name === "function") { const n = p.get_Name(); if (n) return String(n); }
                } catch (e) {}
                return "Unknown";
            }


            // ── Get alliance members from game client ─────────────────────
            function getAllianceMembers() {
                const members = [];
                try {
                    const md       = ClientLib.Data.MainData.GetInstance();
                    const alliance = md.get_Alliance();
                    if (!alliance) return members;

                    // Members live in OKCDYB.d as plain objects with a Name property
                    const memberCollection = alliance.OKCDYB;
                    const d = memberCollection && memberCollection.d ? memberCollection.d : null;
                    if (!d) return members;

                    for (const id in d) {
                        try {
                            const m    = d[id];
                            const name = m.Name || (typeof m.get_Name === "function" ? m.get_Name() : null);
                            if (name) members.push(String(name));
                        } catch (e) {}
                    }
                } catch (e) { console.log("[BaseTag v14] getAllianceMembers error:", e); }
                // Always include commander themselves
                if (myPlayerName && !members.includes(myPlayerName)) members.unshift(myPlayerName);
                return members.sort(function(a,b){ return a.toLowerCase().localeCompare(b.toLowerCase()); });
            }

            // ── Auto sync alliance members to allowlist ──────────────────
        function autoSyncAllianceMembers() {

            const members = getAllianceMembers();
            if (!members.length) return;

            const hash = JSON.stringify(members);

            if (hash === lastPlayersHash) {
                return;
            }

            lastPlayersHash = hash;

            syncSetPlayers(members, function(d) {
                if (d && d.ok) {
                    console.log("[BaseTag v14] Alliance members synced:", members.length);
                }
            });
        }

            // ── Shift-click bulk select ───────────────────────────────────
            function hookShiftClick() {}
            function showShiftPanel() {}

            function esc(s) { return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

            // ── Sim Save ─────────────────────────────────────────────────
            function hookSimSave() {
                // One lightweight watcher instead of two independent 500ms/1000ms pollers.
                // It first compares the raw localStorage string; JSON parsing happens only
                // when the simulator layout data actually changed.
                let lastRaw = localStorage.getItem("ta_sim_layouts") || "{}";
                let lastParsed = safeParseLayouts(lastRaw);
                setInterval(function(){
                    try {
                        const raw = localStorage.getItem("ta_sim_layouts") || "{}";
                        if(raw === lastRaw) return;
                        const parsed = safeParseLayouts(raw);
                        for(const id in lastParsed){
                            const pc=countLayouts(lastParsed[id]||{}), cc=countLayouts(parsed[id]||{});
                            if(cc>pc) onSimSave(String(id));
                            else if(cc<pc) onSimDelete(String(id),cc);
                        }
                        for(const id in parsed){
                            if(!(id in lastParsed)) onSimSave(String(id));
                        }
                        lastRaw=raw;
                        lastParsed=parsed;
                    } catch(e) {}
                }, 2000);
            }
            function safeParseLayouts(r) { try { return JSON.parse(r)||{}; } catch(e) { return {}; } }
            function countLayouts(m) { let n=0; try { for(const id in m) n+=Object.keys(m[id]||{}).length; } catch(e) {} return n; }
            function onSimSave(targetId) { const c=resolveById(targetId); if(!c) return; const k=key(c.x,c.y); if(!marks[k]||mySimSaves[k]) return; mySimSaves[k]=true; saveLocal(SIM_STORAGE_KEY,mySimSaves); refreshMarkedObjects(); }
            function onSimDelete(targetId,remaining) { if(remaining>0) return; const c=resolveById(targetId); if(!c) return; const k=key(c.x,c.y); if(!mySimSaves[k]) return; delete mySimSaves[k]; saveLocal(SIM_STORAGE_KEY,mySimSaves); refreshMarkedObjects(); }
            function resolveById(id) {
                id=String(id);
                try {
                    const indexedMark = marksById[id];
                    if(indexedMark) return {x:indexedMark.x,y:indexedMark.y};
                    const md=ClientLib.Data.MainData.GetInstance();
                    const ac=md.get_Cities().get_AllCities().d;
                    if(ac&&ac[id]&&typeof ac[id].get_RawX==="function") return {x:ac[id].get_RawX(),y:ac[id].get_RawY()};
                    const w=md.get_World();
                    if(w&&typeof w.get_NpcBases==="function") { const nb=w.get_NpcBases(); if(nb&&nb.d&&nb.d[id]&&typeof nb.d[id].get_RawX==="function") return {x:nb.d[id].get_RawX(),y:nb.d[id].get_RawY()}; }
                } catch(e) {}
                return null;
            }
            function markSimSaved(x,y) { mySimSaves[key(x,y)]=true; saveLocal(SIM_STORAGE_KEY,mySimSaves); refreshMarkedObjects(); }
            function clearSimSaved(x,y) { delete mySimSaves[key(x,y)]; saveLocal(SIM_STORAGE_KEY,mySimSaves); refreshMarkedObjects(); }

            // ── API ───────────────────────────────────────────────────────
        function revokeAccess() {
            if (!accessGranted) return;

            accessGranted = false;
            accessPassword = "";

            try { localStorage.removeItem(PASSWORD_STORAGE_KEY); } catch (e) {}

            Object.keys(marks).forEach(function(k) { delete marks[k]; });
            try { saveLocal(STORAGE_KEY, marks); } catch (e) {}
            try { refreshMarkedObjects(); } catch (e) {}

            window.alert("BaseTag: ACCESS DENIED. The password is no longer valid. Reload the game and enter the new password.");
        }

        function apiCall(params, cb) {
            params = params || {};
            params.world = FORCE_WORLD_ID;
            params._ = Date.now();

            if (accessPassword) {
                params.password = accessPassword;
            }

            const url = API_URL + "?" + Object.keys(params)
                .map(k => encodeURIComponent(k) + "=" + encodeURIComponent(params[k]))
                .join("&");

            GM_xmlhttpRequest({
                // GET is deliberate: Google Apps Script's /exec redirects, and Opera/MV3
                // has had browser-specific GM_xmlhttpRequest behavior around redirects/POST.
                // All BaseTag parameters are already in the query string.
                method: "GET",
                url: url,
                timeout: 30000,
                onload: function(res) {
                    let data = null;
                    try {
                        data = JSON.parse(res.responseText);
                    } catch(e) {
                        console.error("BaseTag API JSON ERROR:", e, "HTTP", res && res.status);
                    }

                    apiDown = false;
                    if (cb) cb(data);
                },
                onerror: function(err) {
                    console.error("BaseTag API REQUEST ERROR:", err);
                    apiDown = true;
                    if (cb) cb(null);
                },
                ontimeout: function(err) {
                    console.error("BaseTag API REQUEST TIMEOUT:", err);
                    apiDown = true;
                    if (cb) cb(null);
                }
            });
        }
        function syncFromServer() {

            if (syncInProgress) return;

            syncInProgress = true;

            // Existing single-flight guard prevents duplicate simultaneous downloads.
            // One-shot fail-safe releases it only if the transport never calls back.
            const syncWatchdog = setTimeout(function(){
                syncInProgress = false;
            }, 35000);

            apiCall({ action:"list", player:myPlayerName }, function(data) {
                clearTimeout(syncWatchdog);

                syncInProgress = false;

                if(data && data.banned === true) {
                    Object.keys(marks).forEach(function(k) { delete marks[k]; });
                    try { saveLocal(STORAGE_KEY, marks); } catch(e) {}
                    try { refreshMarkedObjects(); } catch(e) {}
                    window.alert("BaseTag: ACCESS BLOCKED. Your player account has been banned from alliance markers.");
                    return;
                }

                if(!data || !data.ok || !Array.isArray(data.marks))
                    return;

                const next = {};

        data.marks.forEach(function(m) {
            if (String(m.world) !== String(FORCE_WORLD_ID)) return;
            next[key(m.x, m.y)] = m;
        });

        // Do nothing when the server returned exactly the same marker state.
        // Previously every 60s we cleared/rebuilt all marks, wrote localStorage,
        // rebuilt indexes and forced UpdateColor/VisUpdate on every marked base.
        const currentKeys=Object.keys(marks);
        const nextKeys=Object.keys(next);
        let changed=currentKeys.length!==nextKeys.length;
        if(!changed){
            for(let i=0;i<nextKeys.length;i++){
                const k=nextKeys[i], a=marks[k], b=next[k];
                if(!a || String(a.id||"")!==String(b.id||"") ||
                   String(a.action||"")!==String(b.action||"") ||
                   String(a.priority||"")!==String(b.priority||"") ||
                   String(a.notes||"")!==String(b.notes||"") ||
                   String(a.name||"")!==String(b.name||"") ||
                   String(a.level||"")!==String(b.level||"") ||
                   String(a.alliance||"")!==String(b.alliance||"") ||
                   String(a.by||"")!==String(b.by||"")){
                    changed=true; break;
                }
            }
        }
        if(!changed) return;

        // Keep the same object identity because other code references `marks`.
        currentKeys.forEach(function(k){ delete marks[k]; });
        nextKeys.forEach(function(k){ marks[k]=next[k]; });

        saveLocal(STORAGE_KEY, marks);
        refreshMarkedObjects();
            });
        }
        function syncUpsert(m) {
            console.log("[BaseTag PLAYER] write blocked");
        }
            function syncDelete(m) {
                console.log("[BaseTag PLAYER] delete blocked");
            }
            function syncSetPlayers(playerList, cb) {
                if (cb) cb({ok:false,error:"read only"});
            }
            function syncGetAllowedPlayers(cb) {
                apiCall({ action:"listPlayers", key:ADMIN_KEY }, cb);
            }

            // ── Plate color ───────────────────────────────────────────────
            function hookNativePlateColor() { patchPlateClass(ClientLib.Vis.Region.RegionCity); patchPlateClass(ClientLib.Vis.Region.RegionNPCBase); patchHasAttackFormation(); }
            function findColorMethod(proto) {
                if (!proto) return null;

                // Known names from older TA builds.
                const known = ["WHSCDA", "WXQWPA", "BCUSOS"];
                for (const n of known) {
                    try {
                        if (typeof proto[n] === "function") {
                            const src = Function.prototype.toString.call(proto[n]);
                            // BCUSOS is accepted only when it is really the plate-colour getter.
                            if (n !== "BCUSOS" || src.indexOf("RRLJOR") !== -1) {
                                console.log("[BaseTag] color method:", n);
                                return n;
                            }
                        }
                    } catch (e) {}
                }

                let bestName = null;
                let bestScore = -1;
                const names = Object.getOwnPropertyNames(proto);

                for (const name of names) {
                    try {
                        if (name.startsWith("__")) continue;
                        const fn = proto[name];
                        if (typeof fn !== "function") continue;

                        const src = Function.prototype.toString.call(fn);
                        let score = 0;

                        // EA 27.08.2026 build: the native background-plate colour enum
                        // is obfuscated as $I.RRLJOR. This is the strongest signature.
                        if (src.indexOf("$I.RRLJOR.") !== -1 || src.indexOf("RRLJOR.") !== -1) score += 30;

                        // Older builds / readable aliases.
                        if (src.indexOf("EBackgroundPlateColor") !== -1) score += 30;

                        // A colour getter is normally a short zero-argument function.
                        if (/^function\s*\(\s*\)/.test(src)) score += 4;
                        if (src.length >= 25 && src.length <= 800) score += 3;

                        // Supporting semantic hints.
                        if (src.indexOf(".Black") !== -1) score += 4;
                        if (src.indexOf(".Blue") !== -1) score += 4;
                        if (src.indexOf(".Cyan") !== -1) score += 4;
                        if (src.indexOf(".Orange") !== -1) score += 4;
                        if (src.indexOf(".White") !== -1) score += 4;

                        if (score > bestScore) {
                            bestScore = score;
                            bestName = name;
                        }
                    } catch (e) {}
                }

                if (bestName && bestScore >= 30) {
                    console.log("[BaseTag] color method auto-detected:", bestName, "score=", bestScore);
                    return bestName;
                }

                console.warn("[BaseTag] color method not found after EA maintenance; patch skipped.", {
                    bestName: bestName,
                    bestScore: bestScore,
                    methods: names
                });
                return null;
            }

            function patchPlateClass(cls) {
            try {

                if (!cls || !cls.prototype || cls.prototype.__AFWBv14)
                    return;

                const mn = findColorMethod(cls.prototype);
                if (!mn)
                    return;

                cls.prototype.__AFWBv14 = true;
                cls.prototype.__AFWBv14Orig = cls.prototype[mn];
                cls.prototype.__AFWBv14Method = mn;

                cls.prototype[mn] = function () {

                    try {

                        const k = key(this.get_RawX(), this.get_RawY());
                        const targetId = String(getId(this) || "");

                        // ===== NATIVE SAVED SIM =====
                        // Saved simulation must be visually distinguishable from BaseTag KILL.
                        // This check is O(1) after the first encounter with a target.
                        if (targetId && isNativeSimTarget(targetId)) {
                            return ClientLib.Vis.EBackgroundPlateColor.Black;
                        }

                        // ===== LOCAL MEMBER =====
                        if (memberMarks[k]) {
                            return ClientLib.Vis.EBackgroundPlateColor.White;
                        }

                        // ===== ALLIANCE =====
                        const action = getActionForObj(this);
                        const mark = marks[k];

                        // FAST
                        if (
                            action === "KILL" &&
                            mark &&
                            mark.priority === "HIGH"
                        ) {
                            return ClientLib.Vis.EBackgroundPlateColor.Cyan;
                        }

                        // KILL
                        if (action === "KILL") {
                            return ClientLib.Vis.EBackgroundPlateColor.Blue;
                        }

                        // IGNORE
                        if (action === "IGNORE") {
                            return ClientLib.Vis.EBackgroundPlateColor.Orange;
                        }

                    } catch (e) {}

                    return this.__AFWBv14Orig.apply(this, arguments);
                };

            } catch (e) {}
        }
            function patchHasAttackFormation() {
                try {
                    const cities = ClientLib.Data.MainData.GetInstance().get_Cities().get_AllCities().d;
                    for (let id in cities) {
                        const c = cities[id];
                        if (!c || c.__AFWBv14HAF || typeof c.HasAttackFormation !== "function") continue;

                        c.__AFWBv14HAF = true;
                        c.__AFWBv14HAFOrig = c.HasAttackFormation;

                        c.HasAttackFormation = function(tid) {
                            let nativeHas = false;
                            try {
                                nativeHas = !!c.__AFWBv14HAFOrig.apply(c, arguments);
                                setNativeSimState(id, tid, nativeHas);
                            } catch (e) {}

                            // BaseTag may still force "has formation" for marked targets,
                            // but that forced state is NOT counted as a native saved SIM.
                            try { if (isMarkedById(tid)) return true; } catch (e) {}
                            return nativeHas;
                        };
                    }
                } catch(e){}
            }
            function hookRegionMenu() {
            const menu = webfrontend.gui.region.RegionCityMenu.getInstance();

            menu.addListener("appear", function () {

                try {

                    const sel = getMenuObj(menu);
                    if (!sel) return;

                    const ch = menu.getChildren();
                    if (!ch || !ch[0]) return;

                    const sub = ch[0];

                    // Snapshot first: getChildren() may be a live collection.
                    const existingMenuChildren = sub.getChildren().slice();
                    existingMenuChildren.forEach(function (c) {
                        try {
                            let remove = false;
                            if (c.getUserData && c.getUserData("AFWBBtn")) remove = true;

                            let lbl = "";
                            try {
                                if (typeof c.getLabel === "function") lbl = String(c.getLabel() || "");
                            } catch (e) {}
                            if (lbl === "✖ REMOVE" || lbl === "BaseTag »") remove = true;

                            if (remove) {
                                sub.remove(c);
                                c.dispose();
                            }
                        } catch (e) {}
                    });

                    const markBtn = new qx.ui.form.MenuButton("BaseTag »");
                    markBtn.setUserData("AFWBBtn", true);
                    markBtn.set({
                        appearance: "button-standard-nod",
                        width: 115,
                        height: 22,
                        textColor: "#ffffff",
                        backgroundColor: "#1d4ed8"
                    });

                    const am = new qx.ui.menu.Menu();

                    const memberBtn = new qx.ui.menu.Button("Mark My Base");
                    memberBtn.setTextColor("#ffffff");
                    memberBtn.addListener("execute", function () {
                        addMemberMark(sel);
                    });
                    am.add(memberBtn);

                    am.add(new qx.ui.menu.Separator());

                    const simB = new qx.ui.menu.Button("Mark Sim Saved");
                    simB.addListener("execute", function () {
                        markSimSaved(sel.get_RawX(), sel.get_RawY());
                    });
                    am.add(simB);

                    const clearSimB = new qx.ui.menu.Button("Clear Sim Saved");
                    clearSimB.addListener("execute", function () {
                        clearSimSaved(sel.get_RawX(), sel.get_RawY());
                        refreshMarkedObjects();
                    });
                    am.add(clearSimB);

                    markBtn.setMenu(am);
                    sub.add(markBtn);

                    // Quick remove. PLAYER can remove only the local MEMBER mark.
                    const quickRemoveBtn = new qx.ui.form.Button("✖ REMOVE");
                    quickRemoveBtn.setUserData("AFWBBtn", true);
                    quickRemoveBtn.set({
                        appearance: "button-standard-nod",
                        width: 115,
                        height: 26,
                        backgroundColor: "#991b1b",
                        textColor: "#ffffff"
                    });
                    quickRemoveBtn.setToolTipText("Remove my local MEMBER mark");
                    quickRemoveBtn.addListener("execute", function () {
                        try {
                            const target = getMenuObj(menu);
                            if (!target) return;
                            removeMarkFromObj(target);
                        } catch (e) {
                            console.error("[BaseTag PLAYER] quick REMOVE:", e);
                        }
                    });
                    sub.add(quickRemoveBtn);

                } catch (e) {
                    console.log("[BaseTag v14] menu:", e);
                }
            });
        }
            // ── Scripts dropdown ──────────────────────────────────────────
            // Use the game's native ScriptsButton API — same mechanism as
            // Tiberium Alliances Battle Simulator V2. This is important on
            // Firefox, where the Scripts button may not exist/render until
            // getScriptsButton().Add(...) is called by a userscript.
            function addTopButton() {
                if (scriptsAdded) return true;

                try {
                    const app = qx.core.Init.getApplication();
                    if (!app || !app.getMenuBar) return false;

                    const menuBar = app.getMenuBar();
                    if (!menuBar || typeof menuBar.getScriptsButton !== "function") {
                        return false;
                    }

                    const scriptsButton = menuBar.getScriptsButton();
                    if (!scriptsButton) return false;

                    // Native ScriptsButton.Add() is the method used by working
                    // TA scripts to make the top-level Scripts control appear.
                    if (typeof scriptsButton.Add === "function") {
                        // Use the game's native Add() only to make the Scripts button/menu
                        // appear, but add BaseTag as a DIRECT menu item (no submenu).
                        scriptsButton.Add("BaseTag", null, null);

                        let nativeMenu = null;
                        try { if (typeof scriptsButton.getMenu === "function") nativeMenu = scriptsButton.getMenu(); } catch (e) {}

                        // Some game builds keep the actual menu in an internal child.
                        // Find the freshly created native "BaseTag" entry and wire it
                        // directly to openBoardSafe().
                        let directItem = null;
                        if (nativeMenu && typeof nativeMenu.getChildren === "function") {
                            const kids = nativeMenu.getChildren();
                            for (let i = kids.length - 1; i >= 0; i--) {
                                try {
                                    if (kids[i].getLabel && String(kids[i].getLabel()) === "BaseTag") {
                                        directItem = kids[i];
                                        break;
                                    }
                                } catch (e) {}
                            }
                        }

                        if (!directItem) {
                            // Fallback: inspect the ScriptsButton object for its menu.
                            for (const prop in scriptsButton) {
                                try {
                                    const candidate = scriptsButton[prop];
                                    if (!candidate || typeof candidate.getChildren !== "function") continue;
                                    const kids = candidate.getChildren();
                                    for (let i = kids.length - 1; i >= 0; i--) {
                                        if (kids[i] && kids[i].getLabel && String(kids[i].getLabel()) === "BaseTag") {
                                            directItem = kids[i];
                                            break;
                                        }
                                    }
                                    if (directItem) break;
                                } catch (e) {}
                            }
                        }

                        if (directItem) {
                            try { directItem.setMenu(null); } catch (e) {}
                            try { if (typeof directItem.setLabel==="function") directItem.setLabel("TA BaseTag PLAYER by Maly"); } catch(e) {}
                            try { if (typeof directItem.setIcon==="function") directItem.setIcon("data:image/png;base64,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"); } catch(e) {}
                            directItem.addListener("execute", function () { openBoardSafe(); });
                            directItem.addListener("click", function () { openBoardSafe(); });
                            scriptsAdded = true;
                            console.log("[BaseTag PLAYER v1.8] Scripts entry ready");
                            return true;
                        }

                        // If Add() made Scripts visible but its created item isn't exposed,
                        // fall through to the regular menu fallback below.
                    }

                    // Fallback for game builds where getScriptsButton() exists
                    // but the native Add method is unavailable.
                    let menu = null;
                    try { if (typeof scriptsButton.getMenu === "function") menu = scriptsButton.getMenu(); } catch (e) {}
                    if (!menu) {
                        try {
                            menu = new qx.ui.menu.Menu();
                            if (typeof scriptsButton.setMenu === "function") scriptsButton.setMenu(menu);
                        } catch (e) {
                            return false;
                        }
                    }

                    const children = menu.getChildren ? menu.getChildren() : [];
                    for (let i = 0; i < children.length; i++) {
                        try {
                            if (children[i].getLabel && String(children[i].getLabel()) === "BaseTag") {
                                scriptsAdded = true;
                                return true;
                            }
                        } catch (e) {}
                    }

                    const item = new qx.ui.menu.Button("TA BaseTag PLAYER by Maly", "data:image/png;base64,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");
                    item.addListener("execute", function () { openBoardSafe(); });
                    menu.add(item);
                    scriptsAdded = true;
                    console.log("[BaseTag v20] Fallback Scripts → BaseTag added");
                    return true;

                } catch (e) {
                    console.log("[BaseTag v20] addTopButton error:", e);
                    return false;
                }
            }

            // ── Mark CRUD ─────────────────────────────────────────────────
        function addMarkFromObj(obj, action, priority) {
            console.log("[BaseTag PLAYER] shared marking blocked");
        }
            function addMemberMark(obj) {

            const x = obj.get_RawX();
            const y = obj.get_RawY();

            memberMarks[key(x, y)] = {

                world: FORCE_WORLD_ID,
                action: "MEMBER",
                mark: "MEMBER",
                priority: "",

                x: x,
                y: y,

                id: getId(obj),
                name: getObjName(obj),
                type: getObjType(obj),
                level: getLevel(obj),
                alliance: getAlliance(obj),

                notes: "",
                by: myPlayerName,

                time: new Date().toLocaleString()

            };

            saveLocal(MEMBER_STORAGE_KEY, memberMarks);

            refreshMarkedObjects();
        }
            function addMarkManual(x,y,name,type,level,alliance,action,priority,notes) {
                const m={world:FORCE_WORLD_ID,action,priority:priority||"MED",x,y,id:"",name:name||"Manual",type:type||"Unknown",level:String(level||""),alliance:alliance||"",notes:notes||"",by:myPlayerName,time:new Date().toLocaleString()};
                marks[key(x,y)]=m; saveLocal(STORAGE_KEY,marks); syncUpsert(m); patchHasAttackFormation(); refreshMarkedObjects();
            }
        function removeMarkFromObj(obj) {
            try {
                const x = obj.get_RawX();
                const y = obj.get_RawY();
                const k = key(x, y);

                // PLAYER quick REMOVE removes ONLY the player's local MEMBER mark.
                // Saved SIM state and shared FAST/KILL/IGNORE markers are untouched.
                if (memberMarks[k]) {
                    delete memberMarks[k];
                    saveLocal(MEMBER_STORAGE_KEY, memberMarks);
                    refreshMarkedObjects();
                }
            } catch (e) {
                console.error("[BaseTag PLAYER] remove local MEMBER mark:", e);
            }
        }

            // ── Helpers ───────────────────────────────────────────────────
            function key(x,y){return x+":"+y;}

            // Fast secondary index: NPC/base ID -> marker.
            // VisUpdate can fire extremely often; never scan all markers from that hot path.
            let marksById = {};

            function rebuildMarksById(){
                const next = {};
                try {
                    for (const k in marks) {
                        const m = marks[k];
                        if (m && m.id != null && String(m.id) !== "") next[String(m.id)] = m;
                    }
                } catch(e) {}
                marksById = next;
            }

            function loadLocal(k){try{return JSON.parse(localStorage.getItem(k)||"{}");}catch(e){return {};}}
            function saveLocal(k,d){
                localStorage.setItem(k,JSON.stringify(d));
                // Marker writes are infrequent compared with VisUpdate, so rebuilding here is cheap
                // and keeps the O(1) ID index always current.
                try { if(k===STORAGE_KEY) rebuildMarksById(); } catch(e) {}
            }
            function getId(o){try{if(o.get_Id) return o.get_Id();}catch(e){} return "";}
            rebuildMarksById();
            function getObjName(o){try{if(o.get_Name) return String(o.get_Name());}catch(e){} return "Unknown";}
            function getObjType(o){try{const t=o.get_VisObjectType(),E=ClientLib.Vis.VisObject.EObjectType; if(t===E.RegionCityType) return "Player Base"; if(t===E.RegionNPCBase) return "Forgotten Base"; if(t===E.RegionNPCCamp) return "Camp/Outpost"; if(t===E.RegionPointOfInterest) return "POI"; if(t===E.RegionRuin) return "Ruin";}catch(e){} return "Object";}
            function getAlliance(o){try{if(o.get_AllianceName) return o.get_AllianceName()||"";}catch(e){} return "";}
            function getLevel(o){let v=""; try{if(o.get_BaseLevel) v=o.get_BaseLevel();}catch(e){} if(v===""||v==null){try{if(o.get_Level) v=o.get_Level();}catch(e){}} if(v===""||v==null){try{if(o.get_BaseLevelFloat) v=Math.floor(o.get_BaseLevelFloat());}catch(e){}} v=String(v||"").replace(/[^\d.]/g,""); if(v.indexOf(".")!==-1) v=String(Math.floor(Number(v))); return v||"";}
            function isMarkedById(id){
                if(id==null) return false;
                return !!marksById[String(id)];
            }
            function getActionForObj(o) {
                try {
                    const k = key(o.get_RawX(), o.get_RawY());

                    // O(1): local MEMBER marker by coordinates.
                    if (memberMarks[k]) return "MEMBER";

                    // O(1): shared marker by coordinates.
                    const m = marks[k];
                    if (m && (m.action === "KILL" || m.action === "IGNORE")) return m.action;

                    // O(1): fallback by NPC/base ID.
                    // Previously this looped over EVERY marker on EVERY VisUpdate.
                    const id = String(getId(o));
                    if (id && marksById[id]) return marksById[id].action;
                } catch (e) {}
                return null;
        }
            function getVisObjAt(x,y){try{const r=ClientLib.Vis.VisMain.GetInstance().get_Region(); return r.GetObjectFromPosition(x*r.get_GridWidth(),y*r.get_GridHeight());}catch(e){return null;}}
            function getWorldObjAt(x,y){try{return ClientLib.Data.MainData.GetInstance().get_World().GetObjectFromPosition(x,y);}catch(e){return null;}}
            function isDeadOrGone(x,y){const w=getWorldObjAt(x,y),v=getVisObjAt(x,y); if(!w&&!v) return false; try{if(v&&v.get_VisObjectType()===ClientLib.Vis.VisObject.EObjectType.RegionRuin) return true;}catch(e){} try{if(w&&w.Type===ClientLib.Data.WorldSector.ObjectType.Ruin) return true;}catch(e){} return false;}
            function cleanDeadMarks(){let ch=false; const del=[]; Object.keys(marks).forEach(function(k){const m=marks[k]; if(isDeadOrGone(m.x,m.y)){del.push(m);delete marks[k];delete mySimSaves[k];ch=true;}}); if(ch){saveLocal(STORAGE_KEY,marks);saveLocal(SIM_STORAGE_KEY,mySimSaves);del.forEach(syncDelete);}}
            function refreshMarkedObjects(){Object.keys(marks).forEach(function(k){const m=marks[k],o=getVisObjAt(m.x,m.y); if(!o) return; try{if(typeof o.UpdateColor==="function") o.UpdateColor();}catch(e){} try{if(typeof o.UpdateZoom==="function") o.UpdateZoom();}catch(e){} try{if(typeof o.UiUpdate==="function") o.UiUpdate(0);}catch(e){} try{if(typeof o.VisUpdate==="function") o.VisUpdate(0,0,0);}catch(e){}});}
            function getMenuObj(menu){for(let k in menu){try{const o=menu[k]; if(o&&typeof o.get_RawX==="function"&&typeof o.get_RawY==="function") return o;}catch(e){}} return null;}

            // ── Button factory ────────────────────────────────────────────
            function makeBtn(label,bg,fg,w){const b=new qx.ui.form.Button(label); b.set({appearance:"button-standard-nod",height:26,width:w||null,backgroundColor:bg||"#0f172a",textColor:fg||"#c8d8e8"}); return b;}

            // ── Map jump from table row ─────────────────────────────────────
            function jumpToMapCoords(x, y) {
                try {
                    const gx = Number(x);
                    const gy = Number(y);
                    if (!isFinite(gx) || !isFinite(gy)) return;

                    const visMain = ClientLib.Vis.VisMain.GetInstance();
                    const region = visMain && typeof visMain.get_Region === "function"
                        ? visMain.get_Region()
                        : null;

                    if (!region || typeof region.CenterGridPosition !== "function") return;

                    // Keep the BaseTag panel open; only center the map.
                    region.CenterGridPosition(gx, gy);
                } catch (e) {
                    console.log("[BaseTag v29] jumpToMapCoords error:", e);
                }
            }

            // ── Persistent PLAYER UI layout (Commander-equivalent) ───────
            const PANEL_COL_DEFAULTS={time:145,world:55,by:120,byAlliance:95,x:48,y:48,id:105,mark:75,type:115,level:55,name:150,alliance:115,priority:70,notes:170};
            function panelPrefsKey(){
                return "MALY_BASETAG_PLAYER_UI_V1_"+String(FORCE_WORLD_ID)+"_"+String(myPlayerName||"player").toLowerCase();
            }
            function loadPanelPrefs(){
                try{return JSON.parse(localStorage.getItem(panelPrefsKey())||"{}");}catch(e){return {};}
            }
            function savePanelPrefsPatch(patch){
                try{
                    const p=loadPanelPrefs();
                    Object.keys(patch||{}).forEach(function(k){p[k]=patch[k];});
                    localStorage.setItem(panelPrefsKey(),JSON.stringify(p));
                }catch(e){}
            }
            function savePanelBounds(w){
                try{
                    if(!w||typeof w.getBounds!=="function")return;
                    const b=w.getBounds(); if(!b)return;
                    savePanelPrefsPatch({window:{left:Number(b.left)||0,top:Number(b.top)||0,width:Number(b.width)||1020,height:Number(b.height)||680}});
                }catch(e){}
            }

            // ── Open Board ────────────────────────────────────────────────
            // Firefox-safe opener: close Qooxdoo menus first and open the window
            // on the next event-loop tick. This avoids menu/window event conflicts.
            function openBoardSafe() {
                try {
                    if (qx.ui && qx.ui.menu && qx.ui.menu.Manager) {
                        qx.ui.menu.Manager.getInstance().hideAll();
                    }
                } catch (e) {}

                const run = function () {
                    try {
                        openBoard();
                    } catch (e) {
                        console.error("[BaseTag v16] openBoard error:", e);
                    }
                };

                try {
                    if (qx.event && qx.event.Timer && typeof qx.event.Timer.once === "function") {
                        qx.event.Timer.once(run, null, 1);
                        return;
                    }
                } catch (e) {}

                setTimeout(run, 1);
            }

            function openBoard() {
                if(panel){try{panel.close();panel.destroy();}catch(e){} panel=null;}
                const app=qx.core.Init.getApplication();
                if (!app) throw new Error("Qooxdoo application not ready");

                const win=new qx.ui.window.Window("TA BaseTag PLAYER by Maly");
                try { win.setIcon("data:image/png;base64,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"); } catch(e) { console.log("[BaseTag PLAYER] title icon:",e); }
                const panelPrefs=loadPanelPrefs();
                const savedWin=panelPrefs.window||{};
                const initialW=Math.max(760,Number(savedWin.width)||1020);
                const initialH=Math.max(500,Number(savedWin.height)||680);
                win.set({width:initialW,height:initialH,allowMaximize:true,showMinimize:false,contentPadding:0,backgroundColor:"#080b14"});
                win.setLayout(new qx.ui.layout.VBox(0));

                try { if(typeof win.setUseMoveFrame==="function") win.setUseMoveFrame(true); } catch(e) {}
                try { if(typeof win.setUseResizeFrame==="function") win.setUseResizeFrame(true); } catch(e) {}

                let panelBoundsSaveTimer=null;
                function schedulePanelBoundsSave(){
                    if(panelBoundsSaveTimer)clearTimeout(panelBoundsSaveTimer);
                    panelBoundsSaveTimer=setTimeout(function(){panelBoundsSaveTimer=null;savePanelBounds(win);},700);
                }
                win.addListener("move",schedulePanelBoundsSave);
                win.addListener("resize",schedulePanelBoundsSave);

                // Same root-cause protection as the latest Commander:
                // floating window only on TA Desktop, never on application Root.
                let host=null;
                try { if(typeof app.getDesktop==="function") host=app.getDesktop(); } catch(e) {}
                if(!host || typeof host.add!=="function"){
                    throw new Error("BaseTag: game Desktop not ready; refusing Root fallback to protect game viewport.");
                }
                try {
                    const hostEl=host.getContentElement&&host.getContentElement();
                    if(hostEl&&typeof hostEl.setStyle==="function")hostEl.setStyle("overflow","hidden");
                } catch(e) {}

                host.add(win);
                panel=win;

                const allArr = Object.entries(marks).map(function(e){
            const mk = e[0], mv = e[1];
            return Object.assign({}, mv, {
                k: mk,
                simSaved: !!mySimSaves[mk]
            });
        });

        const fast = allArr
            .filter(m => m.action === "KILL" && m.priority === "HIGH")
            .sort(priSort);

        const kills = allArr
            .filter(m => m.action === "KILL" && m.priority !== "HIGH")
            .sort(priSort);

        const ignores = allArr
            .filter(m => m.action === "IGNORE")
            .sort(priSort);

        const members = Object.entries(memberMarks).map(function(e){
            return Object.assign({}, e[1], {
                k:e[0],
                action:"MEMBER",
                mark:"MEMBER",
                priority:""
            });
        });

        const simmed = allArr.filter(m => m.simSaved);
                // Stats bar
                const statsBar=new qx.ui.container.Composite(new qx.ui.layout.HBox(14)); statsBar.set({padding:[5,12],backgroundColor:"#0a0f1e"});
                function statLbl(val,label,col){const c=new qx.ui.container.Composite(new qx.ui.layout.VBox(0)); c.set({padding:[2,8],backgroundColor:"#0d1529"}); const vl=new qx.ui.basic.Label(String(val)); vl.set({font:"bold",textColor:col||"#00ccff",alignX:"center"}); const ll=new qx.ui.basic.Label(label); ll.set({textColor:"#334155",alignX:"center"}); c.add(vl);c.add(ll); return c;}
                statsBar.add(statLbl(allArr.length,"TOTAL","#94a3b8"));
        statsBar.add(statLbl(fast.length,"FAST","#00ccff"));
        statsBar.add(statLbl(kills.length,"KILL","#2563eb"));
        statsBar.add(statLbl(ignores.length,"IGNORE","#ef4444"));
        statsBar.add(statLbl(members.length,"MEMBER","#ffffff"));
        statsBar.add(statLbl(simmed.length,"SIM ✓","#a78bfa"));
                const flex1=new qx.ui.core.Spacer(); flex1.setWidth(1); statsBar.add(flex1,{flex:1});
                const apiLbl=new qx.ui.basic.Label(apiDown?"⚠ Sheet offline":"● Sheet live"); apiLbl.set({textColor:apiDown?"#ef4444":"#22c55e",alignY:"middle"}); statsBar.add(apiLbl);
                const playerLbl=new qx.ui.basic.Label("Player: "+myPlayerName); playerLbl.set({textColor:"#475569",alignY:"middle"}); statsBar.add(playerLbl);
                win.add(statsBar);

                // Tab bar
                const tabBar=new qx.ui.container.Composite(new qx.ui.layout.HBox(0)); tabBar.set({backgroundColor:"#060910"});
                const tabMarks=new qx.ui.form.Button("⚔ BaseTag"); tabMarks.set({appearance:"button-standard-nod",height:30,backgroundColor:"#0a2a4a",textColor:"#00ccff"});
                tabBar.add(tabMarks);
                win.add(tabBar);

                // Pages
                const pageMarks=new qx.ui.container.Composite(new qx.ui.layout.VBox(0)); pageMarks.set({backgroundColor:"#080b14"});

                function showTab(tab) {
                    pageMarks.setVisibility("visible");
                    tabMarks.setBackgroundColor("#0a2a4a");
                    tabMarks.setTextColor("#00ccff");
                }
                tabMarks.addListener("execute",function(){showTab("marks");});

                // ── BaseTag page ────────────────────────────────────────
                const toolbar=new qx.ui.container.Composite(new qx.ui.layout.HBox(6)); toolbar.set({padding:[5,10],backgroundColor:"#0a0f1e"});
                let currentFilter=String(panelPrefs.filter||"ALL").toUpperCase(); let contentArea=null;
                if(["ALL","FAST","KILL","IGNORE","MEMBER","SIM"].indexOf(currentFilter)===-1)currentFilter="ALL";
                let sortColumn=panelPrefs.sortColumn||"time", sortDirection=Number(panelPrefs.sortDirection)||-1;
                let columnWidths=Object.assign({},PANEL_COL_DEFAULTS,panelPrefs.columns||{});
                let columnRuntimeWidgets={};
                function rememberColumns(){savePanelPrefsPatch({columns:columnWidths});}
                let currentPage=Math.max(1,Number(panelPrefs.page)||1);
                let pageSize=Number(panelPrefs.pageSize)||100;
                if([50,100,200].indexOf(pageSize)===-1)pageSize=100;
                let pagerInfo=null, btnPrevPage=null, btnNextPage=null, pageSizeSelect=null;

                function sortableValue(m,col){
                    if(col==="time"){
                        const raw=String(m.time||"").trim();
                        if(!raw) return 0;
                        const mt=raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
                        if(mt) return new Date(Number(mt[1]),Number(mt[2])-1,Number(mt[3]),Number(mt[4]),Number(mt[5]),Number(mt[6])).getTime();
                        const parsed=Date.parse(raw);
                        return Number.isFinite(parsed)?parsed:0;
                    }
                    if(col==="world"||col==="x"||col==="y"||col==="level") return Number(m[col]||0);
                    if(col==="mark") return String(m.action||m.mark||"").toLowerCase();
                    if(col==="alliance") return String(m.alliance||"").toLowerCase();
                    return String(m[col]||"").toLowerCase();
                }
                function sortRows(rows){
                    return rows.slice().sort(function(a,b){
                        const av=sortableValue(a,sortColumn),bv=sortableValue(b,sortColumn);
                        if(av<bv)return -sortDirection;if(av>bv)return sortDirection;
                        return (Number(a.y||0)-Number(b.y||0))||(Number(a.x||0)-Number(b.x||0));
                    });
                }
                const btnAll     = makeBtn("All ("+allArr.length+")","#0a2a4a","#00ccff",80);
        const btnFast    = makeBtn("FAST ("+fast.length+")","#0f172a","#00ccff",95);
        const btnKill    = makeBtn("🔵 KILL ("+kills.length+")","#0f172a","#94a3b8",95);
        const btnIgnore  = makeBtn("IGNORE ("+ignores.length+")","#0f172a","#ef4444",105);
        const btnMember  = makeBtn("MEMBER ("+members.length+")","#0f172a","#ffffff",110);
        const btnSim     = makeBtn("🟣 SIM ("+simmed.length+")","#0f172a","#94a3b8",85);

        function setFilter(f,activeBtn){

            currentFilter=f;
            currentPage=1;

            [
                btnAll,
                btnFast,
                btnKill,
                btnIgnore,
                btnMember,
                btnSim
            ].forEach(function(b){
                b.setBackgroundColor("#0f172a");
            });

            activeBtn.setBackgroundColor("#0a2a4a");

            rebuildContent();

        }

        btnAll.addListener("execute",function(){setFilter("ALL",btnAll);});
        btnFast.addListener("execute",function(){setFilter("FAST",btnFast);});
        btnKill.addListener("execute",function(){setFilter("KILL",btnKill);});
        btnIgnore.addListener("execute",function(){setFilter("IGNORE",btnIgnore);});
        btnMember.addListener("execute",function(){setFilter("MEMBER",btnMember);});
        btnSim.addListener("execute",function(){setFilter("SIM",btnSim);});

        // Restore saved filter highlight without resetting saved page.
        [btnAll,btnFast,btnKill,btnIgnore,btnMember,btnSim].forEach(function(b){b.setBackgroundColor("#1e293b");b.setTextColor("#cbd5e1");});
        const restoredFilterBtn=currentFilter==="FAST"?btnFast:currentFilter==="KILL"?btnKill:currentFilter==="IGNORE"?btnIgnore:currentFilter==="MEMBER"?btnMember:currentFilter==="SIM"?btnSim:btnAll;
        restoredFilterBtn.setBackgroundColor("#0a2a4a"); restoredFilterBtn.setTextColor("#00ccff");

        btnAll.setBackgroundColor("#0a2a4a");

        toolbar.add(btnAll);
        toolbar.add(btnFast);
        toolbar.add(btnKill);
        toolbar.add(btnIgnore);
        toolbar.add(btnMember);
        toolbar.add(btnSim);

                const flex2=new qx.ui.core.Spacer();
                flex2.setWidth(1);
                toolbar.add(flex2,{flex:1});
                const btnSync=makeBtn("↻ Sync","#0f172a","#94a3b8",70);
                btnSync.addListener("execute",function(){syncFromServer(); btnSync.setLabel("Syncing…"); setTimeout(function(){btnSync.setLabel("↻ Sync");},1400);});
                toolbar.add(btnSync);

                const updateStatus=new qx.ui.basic.Label("v"+BASETAG_LOCAL_VERSION);
                updateStatus.set({textColor:"#475569",alignY:"middle",paddingLeft:6});
                toolbar.add(updateStatus);

                const btnUpdate=makeBtn("CHECK UPDATE","#0f172a","#94a3b8",125);
                btnUpdate.addListener("execute",function(){
                    if(btnUpdate.__baseTagUpdateReady){
                        // Open the exact .user.js RAW URL. Tampermonkey handles install/update.
                        try{
                            const a=document.createElement("a");
                            a.href=BASETAG_RAW_UPDATE_URL+"?install="+Date.now();
                            a.target="_blank";
                            a.rel="noopener";
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                        }catch(e){
                            try{pageWindow.open(BASETAG_RAW_UPDATE_URL+"?install="+Date.now(),"_blank");}catch(ex){}
                        }
                        return;
                    }
                    checkBaseTagUpdate(btnUpdate,updateStatus);
                });
                toolbar.add(btnUpdate);

                pageMarks.add(toolbar);

                const pagerBar=new qx.ui.container.Composite(new qx.ui.layout.HBox(6));
                pagerBar.set({padding:[4,10],backgroundColor:"#080d18"});
                btnPrevPage=makeBtn("◀","#0f172a","#94a3b8",42);
                btnNextPage=makeBtn("▶","#0f172a","#94a3b8",42);
                pagerInfo=new qx.ui.basic.Label("");
                pagerInfo.set({textColor:"#64748b",alignY:"middle",width:180});
                pageSizeSelect=new qx.ui.form.SelectBox(); pageSizeSelect.set({width:75});
                [50,100,200].forEach(function(v){
                    const it=new qx.ui.form.ListItem(String(v)); it.setModel(v); pageSizeSelect.add(it);
                    if(v===pageSize)pageSizeSelect.setSelection([it]);
                });
                btnPrevPage.addListener("execute",function(){if(currentPage>1){currentPage--;savePanelPrefsPatch({page:currentPage});rebuildContent();}});
                btnNextPage.addListener("execute",function(){currentPage++;savePanelPrefsPatch({page:currentPage});rebuildContent();});
                pageSizeSelect.addListener("changeSelection",function(){
                    const s=pageSizeSelect.getSelection()[0]; if(!s)return;
                    pageSize=Number(s.getModel())||100; currentPage=1; savePanelPrefsPatch({pageSize:pageSize,page:1}); rebuildContent();
                });
                pagerBar.add(btnPrevPage); pagerBar.add(btnNextPage); pagerBar.add(pagerInfo);
                const pagerFlex=new qx.ui.core.Spacer(); pagerBar.add(pagerFlex,{flex:1});
                const rowsLbl=new qx.ui.basic.Label("Rows:"); rowsLbl.set({textColor:"#475569",alignY:"middle"}); pagerBar.add(rowsLbl);
                pagerBar.add(pageSizeSelect);
                pageMarks.add(pagerBar);

                const scroll=new qx.ui.container.Scroll(); scroll.set({backgroundColor:"#080b14",minHeight:400});
                const outerVbox=new qx.ui.container.Composite(new qx.ui.layout.VBox(6)); outerVbox.set({padding:10,backgroundColor:"#080b14"});

                contentArea=new qx.ui.container.Composite(new qx.ui.layout.VBox(4)); outerVbox.add(contentArea,{flex:1});
                scroll.add(outerVbox); pageMarks.add(scroll,{flex:1});

                // Legend
                const legendBar=new qx.ui.container.Composite(new qx.ui.layout.HBox(16)); legendBar.set({padding:[4,12],backgroundColor:"#060910"});
                function legendItem(color,text){const row=new qx.ui.container.Composite(new qx.ui.layout.HBox(4)); const dot=new qx.ui.basic.Label("●"); dot.set({textColor:color}); const lbl=new qx.ui.basic.Label(text); lbl.set({textColor:"#1e3a5a"}); row.add(dot);row.add(lbl); return row;}
                legendBar.add(legendItem("#00ccff","Cyan = FAST")); legendBar.add(legendItem("#2563eb","Blue = KILL")); legendBar.add(legendItem("#ef4444","Red = IGNORE")); legendBar.add(legendItem("#ffffff","White = MEMBER"));
                const flex3=new qx.ui.core.Spacer(); legendBar.add(flex3,{flex:1});
                const vLbl=new qx.ui.basic.Label("PLAYER v"+BASETAG_LOCAL_VERSION+" · World "+FORCE_WORLD_ID); vLbl.set({textColor:"#0f1a2e"}); legendBar.add(vLbl);
                pageMarks.add(legendBar);

                win.add(pageMarks,{flex:1});
                win.open();
                try { win.show(); } catch (e) {}
                try { win.setActive(true); } catch (e) {}
                try {
                    if(Number.isFinite(Number(savedWin.left))&&Number.isFinite(Number(savedWin.top))) win.moveTo(Number(savedWin.left),Number(savedWin.top));
                    else win.moveTo(Math.max(10,Math.floor((window.innerWidth-initialW)/2)),Math.max(40,Math.floor((window.innerHeight-initialH)/2)));
                } catch (e) {}

                // Build marks content
                function priSort(a,b){return ({HIGH:0,MED:1,LOW:2}[a.priority]??1)-({HIGH:0,MED:1,LOW:2}[b.priority]??1);}
                function rebuildContent() {
                    contentArea.removeAll();
                    const filtered =
            currentFilter==="ALL"     ? allArr :
            currentFilter==="FAST"    ? fast :
            currentFilter==="KILL"    ? kills :
            currentFilter==="IGNORE"  ? ignores :
            currentFilter==="MEMBER"  ? members :
            currentFilter==="SIM"     ? simmed :
            allArr;
                    const sorted=sortRows(filtered);
                    const totalPages=Math.max(1,Math.ceil(sorted.length/pageSize));
                    if(currentPage>totalPages)currentPage=totalPages;
                    if(currentPage<1)currentPage=1;
                    savePanelPrefsPatch({page:currentPage});
                    try{pagerInfo.setValue("Page "+currentPage+" / "+totalPages+" · "+sorted.length+" rows");}catch(e){}
                    try{btnPrevPage.setEnabled(currentPage>1);}catch(e){}
                    try{btnNextPage.setEnabled(currentPage<totalPages);}catch(e){}
                    if(!sorted.length){const empty=new qx.ui.basic.Label("No marks matching this filter."); empty.set({textColor:"#1e3a5a",padding:12}); contentArea.add(empty); return;}
                    const pageRows=sorted.slice((currentPage-1)*pageSize,currentPage*pageSize);
                    // Tabs above already filter FAST/KILL/IGNORE/MEMBER/SIM.
                    // One flat table, matching Google Sheet field order.
                    columnRuntimeWidgets={};
                    const hdrRow=new qx.ui.container.Composite(new qx.ui.layout.HBox(0));
                    hdrRow.set({backgroundColor:"#0a0f1e",padding:[2,6]});

                    function registerColumnWidget(col,w){
                        if(!columnRuntimeWidgets[col])columnRuntimeWidgets[col]=[];
                        columnRuntimeWidgets[col].push(w);
                    }
                    function applyColumnWidth(col,width){
                        width=Math.max(36,Math.min(500,Math.round(width)));
                        columnWidths[col]=width;
                        (columnRuntimeWidgets[col]||[]).forEach(function(w){try{w.setWidth(width);}catch(e){}});
                    }
                    function eventX(e){try{if(typeof e.getDocumentLeft==="function")return e.getDocumentLeft();if(typeof e.getScreenLeft==="function")return e.getScreenLeft();}catch(ex){}return 0;}
                    function hdrCell(txt,col){
                        const wrap=new qx.ui.container.Composite(new qx.ui.layout.HBox(0));
                        wrap.set({width:Number(columnWidths[col])||PANEL_COL_DEFAULTS[col]||80,height:26});
                        registerColumnWidget(col,wrap);
                        const bt=new qx.ui.form.Button(txt+(sortColumn===col?(sortDirection===1?" ▲":" ▼"):""));
                        bt.set({appearance:"button-standard-nod",backgroundColor:"#0a0f1e",textColor:sortColumn===col?"#00ccff":"#64748b",height:26,padding:[0,3]});
                        bt.addListener("execute",function(){
                            if(sortColumn===col)sortDirection*=-1;
                            else{sortColumn=col;sortDirection=(col==="time"||col==="world"||col==="x"||col==="y"||col==="level")?-1:1;}
                            savePanelPrefsPatch({sortColumn:sortColumn,sortDirection:sortDirection});
                            rebuildContent();
                        });
                        wrap.add(bt,{flex:1});
                        const grip=new qx.ui.core.Widget();
                        grip.set({width:5,height:26,cursor:"col-resize",backgroundColor:"#263449"});
                        let dragging=false,startX=0,startW=0;
                        grip.addListener("pointerdown",function(e){dragging=true;startX=eventX(e);startW=Number(columnWidths[col])||80;try{grip.capture();e.stopPropagation();}catch(ex){}});
                        grip.addListener("pointermove",function(e){if(!dragging)return;applyColumnWidth(col,startW+(eventX(e)-startX));try{e.stopPropagation();}catch(ex){}});
                        function finishGrip(e){if(!dragging)return;dragging=false;rememberColumns();try{grip.releaseCapture();if(e)e.stopPropagation();}catch(ex){}}
                        grip.addListener("pointerup",finishGrip); grip.addListener("losecapture",finishGrip);
                        wrap.add(grip); hdrRow.add(wrap);
                    }

                    hdrCell("time","time"); hdrCell("world","world"); hdrCell("by","by");
                    hdrCell("byAlliance","byAlliance"); hdrCell("x","x"); hdrCell("y","y");
                    hdrCell("id","id"); hdrCell("mark","mark"); hdrCell("type","type");
                    hdrCell("level","level"); hdrCell("name","name"); hdrCell("targetAlliance","alliance");
                    hdrCell("priority","priority"); hdrCell("notes","notes");
                    const delHdr=new qx.ui.basic.Label("Delete");
                    delHdr.set({textColor:"#1e3a5a",width:55,font:"bold",alignY:"middle"});
                    hdrRow.add(delHdr);
                    contentArea.add(hdrRow);

                    pageRows.forEach(function(m,idx){
                        const isMember=(m.action==="MEMBER"||m.mark==="MEMBER");
                        // Same subdued alternating rows as Commander; KILL remains subtly red.
                        const rowBg=m.action==="KILL"?(idx%2===0?"#140808":"#110606"):(idx%2===0?"#0f1105":"#0d0f04");
                        const row=new qx.ui.container.Composite(new qx.ui.layout.HBox(0));
                        row.set({backgroundColor:rowBg,padding:[3,6],cursor:"pointer"});
                        row.setToolTipText("Click row to center map on ["+m.x+":"+m.y+"]");
                        (function(cx,cy){row.addListener("click",function(){jumpToMapCoords(cx,cy);});})(m.x,m.y);

                        function cell(txt,col,color){
                            const l=new qx.ui.basic.Label(esc(String(txt==null?"":txt)));
                            l.set({textColor:color||"#c8d8e8",width:Number(columnWidths[col])||PANEL_COL_DEFAULTS[col]||80,alignY:"middle",height:24});
                            registerColumnWidget(col,l); row.add(l);
                        }

                        cell(m.time||"","time","#64748b");
                        cell(m.world||FORCE_WORLD_ID,"world","#64748b");
                        cell(m.by||"","by","#64748b");
                        cell(m.byAlliance||"","byAlliance","#64748b");
                        cell(m.x,"x","#94a3b8"); cell(m.y,"y","#94a3b8");
                        cell(m.id||"","id","#475569");
                        cell(m.action||m.mark||"","mark",m.action==="IGNORE"?"#ef4444":(m.priority==="HIGH"?"#00ccff":"#3b82f6"));
                        cell(m.type||"","type","#475569"); cell(m.level||"","level","#fbbf24");
                        cell(m.name||"","name",m.simSaved?"#a78bfa":"#c8d8e8");
                        cell(m.alliance||"","alliance","#475569"); cell(m.priority||"","priority","#94a3b8");
                        cell(isMember?"LOCAL":(m.notes||""),"notes",isMember?"#ffffff":"#94a3b8");

                        const deleteCell=new qx.ui.container.Composite(new qx.ui.layout.HBox(0));
                        deleteCell.set({width:55,alignY:"middle"});

                        if(isMember){
                            const rb=makeBtn("✕","#b91c1c","#ffffff",42);
                            rb.setToolTipText("Delete local MEMBER mark");
                            rb.addListener("click",function(e){try{e.stopPropagation();}catch(ex){}});
                            (function(k){
                                rb.addListener("execute",function(e){
                                    try{e.stopPropagation();}catch(ex){}
                                    if(!memberMarks[k]) return;
                                    delete memberMarks[k];
                                    saveLocal(MEMBER_STORAGE_KEY,memberMarks);
                                    refreshMarkedObjects();
                                    try{contentArea.remove(row);row.destroy();}catch(ex){rebuildContent();}
                                });
                            })(m.k);
                            deleteCell.add(rb);
                        }

                        row.add(deleteCell);
                        contentArea.add(row);
                    });

                }

                rebuildContent();

            }
            function copyBoardText() {

            const lines = [
                "TA BaseTag PLAYER by Maly",
                "Player: " + myPlayerName,
                "Generated: " + new Date().toLocaleString(),
                ""
            ];

            function getTargetOrder(m) {
                if (m.action === "KILL") {
                    return (m.priority === "HIGH") ? 0 : 1; // FAST, KILL
                }
                return 2; // IGNORE
            }

            ACTIONS.forEach(function(action) {

                const group = Object.values(marks).filter(function(m) {
                    return m.action === action;
                });

                if (!group.length) return;

                lines.push("[" + action + "]");

                group
                    .sort(function(a, b) {
                        return getTargetOrder(a) - getTargetOrder(b);
                    })
                    .forEach(function(m, i) {

                        let target;

                        if (m.action === "KILL") {
                            target = (m.priority === "HIGH") ? "FAST" : "KILL";
                        } else {
                            target = "IGNORE";
                        }

                        let line =
                            (i + 1) +
                            ". [" + target + "] " +
                            m.type +
                            " " +
                            m.name +
                            " @ [coords]" + m.x + ":" + m.y + "[/coords]";

                        if (m.level) line += " L" + m.level;
                        if (m.alliance) line += " | " + m.alliance;
                        if (m.notes) line += " — " + m.notes;
                        if (m.by) line += " (by " + m.by + ")";

                        lines.push(line);

                    });

                lines.push("");

            });

            if (!Object.keys(marks).length)
                lines.push("No marks.");

            return lines.join("\n");
        }

            wait();

    }

    // ============================================================
    // PASSWORD AUTH
    // Runs in Tampermonkey/Greasemonkey sandbox BEFORE pageMain().
    // This avoids the Firefox page-message bridge during login.
    // ============================================================

    const AUTH_API_URL = "https://script.google.com/macros/s/AKfycbw9CTsOcrzk_5LQ0TNsX9GWpuZf3vVuZA1MT2YArqD30MjQEjzFMTWWvmVBDpqGaCGI/exec";
    const AUTH_STORAGE_KEY = "AF_WAR_BOARD_PASSWORD_V1";
    let authBusy = false;

    // v1.18 — no shared password. Player self-registers as PENDING.
    function outerDetectPlayerName() {
        try {
            const g = (typeof unsafeWindow !== "undefined" && unsafeWindow) ? unsafeWindow : window;
            const CL = g.ClientLib || (typeof ClientLib !== "undefined" ? ClientLib : null);
            if (!CL || !CL.Data || !CL.Data.MainData) return "";
            const pl = CL.Data.MainData.GetInstance().get_Player();
            if (pl && typeof pl.get_Name === "function") return String(pl.get_Name() || "").trim();
        } catch(e) {}
        return "";
    }

    function requestNickAccess() {
        const name = outerDetectPlayerName();
        if (!name || name === "Unknown") {
            setTimeout(requestNickAccess, 1000);
            return;
        }
        const url = AUTH_API_URL +
            "?action=requestAccess" +
            "&player=" + encodeURIComponent(name) +
            "&_=" + Date.now();

        GM_xmlhttpRequest({
            method: "GET",
            url: url,
            timeout: 30000,
            onload: function(res) {
                let d=null;
                try { d=JSON.parse(res.responseText||""); } catch(e) {}
                if (d && d.ok && d.access === true && String(d.status||"").toUpperCase()==="ALLOWED") {
                    const gameWindow = (typeof unsafeWindow !== "undefined" && unsafeWindow) ? unsafeWindow : window;
                    pageMain(gameWindow, "", GM_xmlhttpRequest);
                    return;
                }
                if (d && (d.banned===true || String(d.status||"").toUpperCase()==="BANNED")) {
                    window.alert("BaseTag: ACCESS BLOCKED. Your player account is banned.");
                    return;
                }
                if (d && (d.pending===true || String(d.status||"").toUpperCase()==="PENDING")) {
                    window.alert("BaseTag: access request sent. Waiting for Commander approval.\n\nAfter approval, reload the world.");
                    return;
                }
                window.alert("BaseTag: access could not be verified. Please reload the world and try again.");
            },
            ontimeout: function() {
                window.alert("BaseTag: access server did not answer. Please reload the world and try again.");
            },
            onerror: function(err) {
                console.error("[BaseTag ACCESS] request failed:",err);
                window.alert("BaseTag: connection to access server failed. Please reload the world and try again.");
            }
        });
    }

    requestNickAccess();

})();
