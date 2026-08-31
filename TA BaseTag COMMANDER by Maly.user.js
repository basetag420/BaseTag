// ==UserScript==
// @name         TA BaseTag COMMANDER by Maly
// @namespace    Maly
// @version      2.71
// @description  Commander BaseTag — server whitelist + per-install device token
// @updateURL    https://raw.githubusercontent.com/basetag420/BaseTag/main/TA%20BaseTag%20COMMANDER%20by%20Maly.user.js
// @downloadURL  https://raw.githubusercontent.com/basetag420/BaseTag/main/TA%20BaseTag%20COMMANDER%20by%20Maly.user.js
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
            const COMMANDER_TOKEN_STORAGE_KEY = "BASETAG_COMMANDER_DEVICE_TOKEN_V1";

            function getOrCreateCommanderToken() {
                try {
                    let token = String(localStorage.getItem(COMMANDER_TOKEN_STORAGE_KEY) || "");
                    if (/^[a-f0-9]{64}$/i.test(token)) return token;
                    const bytes = new Uint8Array(32);
                    const cryptoObj = pageWindow.crypto || (typeof crypto !== "undefined" ? crypto : null);
                    if (!cryptoObj || typeof cryptoObj.getRandomValues !== "function")
                        throw new Error("Secure random generator unavailable");
                    cryptoObj.getRandomValues(bytes);
                    token = Array.from(bytes).map(function(b){ return b.toString(16).padStart(2,"0"); }).join("");
                    localStorage.setItem(COMMANDER_TOKEN_STORAGE_KEY, token);
                    return token;
                } catch(e) {
                    console.error("[BaseTag Commander] device token:", e);
                    return "";
                }
            }

            const commanderDeviceToken = getOrCreateCommanderToken();

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
            let memberMarks = loadLocal(MEMBER_STORAGE_KEY);
            let panel        = null;
            let scriptsAdded = false;
            let apiDown      = false;
            let syncInProgress = false;
            let myPlayerName = "";
            let shiftPending = [];
            let shiftPanel   = null;
            let lastPlayersHash = "";
            const BASETAG_LOCAL_VERSION = "2.71";
            const BASETAG_RAW_UPDATE_URL = "https://raw.githubusercontent.com/basetag420/BaseTag/main/TA%20BaseTag%20COMMANDER%20by%20Maly.user.js";

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

            let commanderAuthorized = false;
            let commanderAuthBusy = false;

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
                if (window.AFWBv14Loaded || commanderAuthBusy) return;
                myPlayerName = detectPlayerName();
                if (!myPlayerName || myPlayerName === "Unknown" || !commanderDeviceToken) return;

                commanderAuthBusy = true;
                apiCall({ action:"commanderAccess" }, function(auth) {
                    commanderAuthBusy = false;

                    if (!auth || !auth.ok) {
                        console.error("[BaseTag Commander] authorization unavailable:", auth);
                        try { window.alert("BaseTag COMMANDER: authorization server unavailable. Commander was NOT started."); } catch(e) {}
                        return;
                    }

                    if (!auth.access || String(auth.status||"").toUpperCase() !== "ALLOWED") {
                        const status = String(auth.status || "PENDING").toUpperCase();
                        console.warn("[BaseTag Commander] access denied:", status);
                        try {
                            window.alert(
                                status === "PENDING"
                                ? "BaseTag COMMANDER: this installation is PENDING.\n\nOpen the Commanders sheet, find " + myPlayerName + " / world " + FORCE_WORLD_ID + " and change status to ALLOWED, then reload the game."
                                : "BaseTag COMMANDER: access denied (" + status + ")."
                            );
                        } catch(e) {}
                        return;
                    }

                    commanderAuthorized = true;
                    window.AFWBv14Loaded = true;

                    try { hookNativePlateColor(); } catch(e){ console.log(e); }
                    try { hookRegionMenu(); } catch(e){ console.log(e); }
                    try { hookSimSave(); } catch(e){ console.log(e); }
                    try { hookShiftClick(); } catch(e){ console.log(e); }

                    try { addTopButton(); } catch(e){ console.log("[BaseTag v19] addTopButton init:", e); }
                    const topButtonRetry = setInterval(function () {
                        if (scriptsAdded) { clearInterval(topButtonRetry); return; }
                        try { addTopButton(); } catch(e){ console.log("[BaseTag v19] addTopButton retry:", e); }
                    }, 1000);

                    try { syncFromServer(); } catch(e){ console.log(e); }
                    setInterval(function () {
                        if (commanderAuthorized) syncFromServer();
                    }, 60000);

                    console.log("[BaseTag Commander] Loaded. Player:", myPlayerName, "World:", FORCE_WORLD_ID);
                });
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
            function hookShiftClick() {
                function attachNative() {
                    try {
                        document.addEventListener("mousedown", function(e) {
                            try {
                                if (!e.shiftKey) return;
                                if (panel) {
                                    try { const winEl = panel.getContentElement().getDomElement(); if (winEl && winEl.contains(e.target)) return; } catch(ex) {}
                                }
                                if (shiftPanel) {
                                    try { const spEl = shiftPanel.getContentElement().getDomElement(); if (spEl && spEl.contains(e.target)) return; } catch(ex) {}
                                }
                                e.preventDefault(); e.stopPropagation();
                                const visMain = ClientLib.Vis.VisMain.GetInstance();
                                const region  = visMain.get_Region();
                                if (!region) return;
                                let offsetX = 0, offsetY = 0;
                                try { const canvas = document.querySelector("canvas") || document.getElementById("qx_0") || document.body; const rect = canvas.getBoundingClientRect(); offsetX = rect.left; offsetY = rect.top; } catch(ex) {}
                                const mouseX = e.clientX - offsetX;
                                const mouseY = e.clientY - offsetY;
                                const gw = region.get_GridWidth  ? region.get_GridWidth()  : 40;
                                const gh = region.get_GridHeight ? region.get_GridHeight() : 40;
                                let sx = 0, sy = 0;
                                try { sx = region.get_ScreenX(); } catch(ex) {}
                                try { sy = region.get_ScreenY(); } catch(ex) {}
                                const tx = Math.floor((mouseX + sx) / gw);
                                const ty = Math.floor((mouseY + sy) / gh);
                                const obj = region.GetObjectFromPosition(tx * gw, ty * gh);
                                if (!obj || typeof obj.get_RawX !== "function") return;
                                const x = obj.get_RawX(), y = obj.get_RawY(), k = key(x, y);
                                if (shiftPending.some(p => p.k === k)) {
                                    shiftPending = shiftPending.filter(p => p.k !== k);
                                } else {
                                    shiftPending.push({ k, x, y, id:getId(obj), name:getObjName(obj), type:getObjType(obj), level:getLevel(obj), alliance:getAlliance(obj) });
                                }
                                showShiftPanel();
                            } catch(err) { console.log("[BaseTag v14] shiftClick:", err); }
                        }, true);
                        window.__AFWBv14_hooked = true;
                    } catch(e) { setTimeout(attachNative, 2000); }
                }
                attachNative();
            }

            function showShiftPanel() {
                if (shiftPanel) { try { shiftPanel.close(); shiftPanel.destroy(); } catch(e) {} shiftPanel = null; }
                if (!shiftPending.length) return;
                const win = new qx.ui.window.Window("⚡ Quick Mark — " + shiftPending.length + " selected");
                win.set({ width:520, height:Math.min(400, 150+shiftPending.length*32), showMinimize:false, showMaximize:false, resizable:false });
                win.setLayout(new qx.ui.layout.VBox(6));
                win.setContentPadding(10);
                win.setBackgroundColor("#0a0e1a");
                const hdr = new qx.ui.basic.Label("<b style='color:#00ccff'>" + shiftPending.length + " target(s) staged</b> <span style='color:#475569'>— Shift+click more or confirm</span>");
                hdr.setRich(true); win.add(hdr);
                const ctrlRow = new qx.ui.container.Composite(new qx.ui.layout.HBox(8));
                const lbl1 = new qx.ui.basic.Label("Action:"); lbl1.set({ textColor:"#64748b", alignY:"middle" }); ctrlRow.add(lbl1);
                const actionSel = new qx.ui.form.SelectBox();
                ACTIONS.forEach(a => { const i = new qx.ui.form.ListItem(a); i.setModel(a); actionSel.add(i); });
                actionSel.set({ width:90, height:26 }); ctrlRow.add(actionSel);
                const lbl2 = new qx.ui.basic.Label("Priority:"); lbl2.set({ textColor:"#64748b", alignY:"middle", marginLeft:10 }); ctrlRow.add(lbl2);
                const priSel = new qx.ui.form.SelectBox();
                PRIORITIES.forEach(p => { const i = new qx.ui.form.ListItem(p); i.setModel(p); priSel.add(i); });
                priSel.set({ width:80, height:26 }); ctrlRow.add(priSel);
                win.add(ctrlRow);
                const scroll = new qx.ui.container.Scroll(); scroll.set({ height:Math.min(180, shiftPending.length*30+10) });
                const vbox = new qx.ui.container.Composite(new qx.ui.layout.VBox(2));
                shiftPending.forEach((item, idx) => {
                    const row = new qx.ui.container.Composite(new qx.ui.layout.HBox(6));
                    row.set({ padding:3, backgroundColor:idx%2===0?"#0f172a":"#111827" });
                    const lbl = new qx.ui.basic.Label("<b style='color:#fbbf24'>L"+(item.level||"?")+"</b> <span style='color:#e2e8f0'>"+esc(item.name)+"</span> <span style='color:#475569'>("+item.type+")</span>");
                    lbl.set({ rich:true, alignY:"middle" }); row.add(lbl, { flex:1 });
                    const rmBtn = new qx.ui.form.Button("✕"); rmBtn.set({ width:24, height:22, appearance:"button-standard-nod", textColor:"#ef4444" });
                    (function(i){ rmBtn.addListener("execute", function() { shiftPending.splice(i,1); showShiftPanel(); }); })(idx);
                    row.add(rmBtn); vbox.add(row);
                });
                scroll.add(vbox); win.add(scroll, { flex:1 });
                const btnRow = new qx.ui.container.Composite(new qx.ui.layout.HBox(8)); btnRow.setMarginTop(4);
                const confirmBtn = new qx.ui.form.Button("✓ Mark All Now");
                confirmBtn.set({ appearance:"button-standard-nod", height:30, textColor:"#ffffff", backgroundColor:"#1d4ed8" });
                confirmBtn.addListener("execute", function() {
                    const action   = actionSel.getSelection()[0] ? actionSel.getSelection()[0].getModel() : "KILL";
                    const priority = priSel.getSelection()[0]    ? priSel.getSelection()[0].getModel()    : "HIGH";
                    shiftPending.forEach(function(item) {
                        const m = { world:FORCE_WORLD_ID, action, priority, x:item.x, y:item.y, id:item.id,
                                    name:item.name, type:item.type, level:item.level, alliance:item.alliance,
                                    byAlliance:getMyAlliance(), notes:"", by:myPlayerName, time:new Date().toLocaleString() };
                        marks[item.k] = m; syncUpsert(m);
                    });
                    saveLocal(STORAGE_KEY, marks);
                    patchHasAttackFormation(); refreshMarkedObjects();
                    shiftPending = [];
                    try { win.close(); win.destroy(); } catch(e) {}
                    shiftPanel = null;
                });
                btnRow.add(confirmBtn, { flex:1 });
                const clearBtn = new qx.ui.form.Button("✕ Clear"); clearBtn.set({ appearance:"button-standard-nod", height:30 });
                clearBtn.addListener("execute", function() { shiftPending = []; try { win.close(); win.destroy(); } catch(e) {} shiftPanel = null; });
                btnRow.add(clearBtn); win.add(btnRow);
                qx.core.Init.getApplication().getRoot().add(win);
                shiftPanel = win; win.open(); win.moveTo(80, 180);
            }

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
            params.commanderPlayer = myPlayerName || detectPlayerName();
            params.commanderToken = commanderDeviceToken;

            if (accessPassword) {
                params.password = accessPassword;
            }

            const url = API_URL + "?" + Object.keys(params)
                .map(k => encodeURIComponent(k) + "=" + encodeURIComponent(params[k]))
                .join("&");

            let finished = false;
            function finish(data) {
                if (finished) return;
                finished = true;
                apiDown = !data;
                if (cb) cb(data);
            }

            function parseResponse(res) {
                try {
                    return JSON.parse(String((res && res.responseText) || ""));
                } catch(e) {
                    console.error("BaseTag API JSON ERROR:", e, "HTTP", res && res.status);
                    return null;
                }
            }

            function sendGetFallback() {
                if (finished) return;
                GM_xmlhttpRequest({
                    method: "GET",
                    url: url,
                    timeout: 30000,
                    onload: function(res) {
                        const data = parseResponse(res);
                        if (data) return finish(data);
                        console.error("BaseTag API GET fallback returned invalid response.");
                        finish(null);
                    },
                    onerror: function(err) {
                        console.error("BaseTag API GET fallback ERROR:", err);
                        finish(null);
                    },
                    ontimeout: function(err) {
                        console.error("BaseTag API GET fallback TIMEOUT:", err);
                        finish(null);
                    }
                });
            }

            // Keep the long-working Commander transport as primary.
            // If a browser/Tampermonkey environment rejects the Apps Script POST/redirect,
            // retry the same request once with the PLAYER-style GET transport.
            GM_xmlhttpRequest({
                method: "POST",
                url: url,
                data: "",
                timeout: 30000,
                onload: function(res) {
                    const data = parseResponse(res);
                    if (data) return finish(data);
                    sendGetFallback();
                },
                onerror: function(err) {
                    console.error("BaseTag API POST ERROR; retrying with GET:", err);
                    sendGetFallback();
                },
                ontimeout: function(err) {
                    console.error("BaseTag API POST TIMEOUT; retrying with GET:", err);
                    sendGetFallback();
                }
            });
        }
        let notifiedPendingPlayers = new Set();
        let requestedPanelTab = null;

        function showAccessRequestNotice(names) {
            if(!names || !names.length) return;
            try {
                const win = new qx.ui.window.Window("BaseTag — Access request");
                win.set({
                    width: 360,
                    height: names.length > 1 ? 150 : 125,
                    showMaximize: false,
                    showMinimize: false,
                    allowMaximize: false,
                    allowMinimize: false,
                    resizable: false,
                    alwaysOnTop: true
                });
                win.setLayout(new qx.ui.layout.VBox(8));
                const text = names.length === 1
                    ? "Player " + names[0] + " is waiting for BaseTag access."
                    : names.length + " players are waiting for BaseTag access:\n" + names.join(", ");
                const label = new qx.ui.basic.Label(text);
                label.set({rich:false, wrap:true, padding:10});
                win.add(label, {flex:1});
                const btn = new qx.ui.form.Button("Open Alliance Access");
                btn.addListener("execute", function(){
                    try { win.close(); } catch(e) {}
                    requestedPanelTab = "access";
                    try { openBoardSafe(); } catch(e) {}
                });
                win.add(btn);
                const app=qx.core.Init.getApplication();
                let noticeHost=null;
                try{if(app&&typeof app.getDesktop==="function")noticeHost=app.getDesktop();}catch(e){}
                if(!noticeHost){try{if(app&&typeof app.getRoot==="function")noticeHost=app.getRoot();}catch(e){}}
                if(!noticeHost||typeof noticeHost.add!=="function")throw new Error("No Qooxdoo host for access notice");
                noticeHost.add(win, {right:20, top:80});
                win.open();
            } catch(e) {
                console.warn("BaseTag access-request notice failed:", e);
            }
        }

        function handlePendingAccessNotice(data) {
            if(!data || !Array.isArray(data.pendingPlayers)) return;
            const current = new Set(data.pendingPlayers.map(function(n){ return String(n||"").trim(); }).filter(Boolean));
            const fresh = [];
            current.forEach(function(n){
                if(!notifiedPendingPlayers.has(n)) fresh.push(n);
            });
            notifiedPendingPlayers = current;
            if(fresh.length) showAccessRequestNotice(fresh);
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

                // Uses the response of this same marker-sync request; no extra network call.
                handlePendingAccessNotice(data);

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

        // Refresh only coordinates whose VISUAL marker state changed.
        // This is the safe PLAYER 1.36 loading optimization:
        // notes/name/level/etc. may update the panel without repainting every marker.
        const changedCoords=Object.create(null);
        currentKeys.forEach(function(k){
            const a=marks[k], b=next[k];
            if(!b || !a ||
               String(a.id||"")!==String(b.id||"") ||
               String(a.action||"")!==String(b.action||"") ||
               String(a.priority||"")!==String(b.priority||"")){
                changedCoords[k]=true;
            }
        });
        nextKeys.forEach(function(k){
            const a=marks[k], b=next[k];
            if(!a || !b ||
               String(a.id||"")!==String(b.id||"") ||
               String(a.action||"")!==String(b.action||"") ||
               String(a.priority||"")!==String(b.priority||"")){
                changedCoords[k]=true;
            }
        });

        // Keep the same object identity because other code references `marks`.
        currentKeys.forEach(function(k){ delete marks[k]; });
        nextKeys.forEach(function(k){ marks[k]=next[k]; });

        saveLocal(STORAGE_KEY, marks);
        refreshMarkedKeys(Object.keys(changedCoords));
            });
        }
        function syncUpsert(m) {

            const params = {
                action: "upsert",
                x: m.x,
                y: m.y,
                id: m.id || "",
                mark: m.action,
                name: m.name || "",
                type: m.type || "",
                level: m.level || "",
                alliance: m.alliance || "",
                byAlliance: m.byAlliance || getMyAlliance() || "",
                priority: m.priority || "MED",
                notes: m.notes || "",
                by: (m && m.__sourceBy) ? String(m.__sourceBy) : myPlayerName
            };

            console.log("UPSERT PARAMS", params);

            apiCall(params, function(d) {
                console.log("SYNC END", d);
            });

        }
            function syncDelete(m) {
            apiCall({
                action: "delete",
                world: m.world || FORCE_WORLD_ID,
                x: m.x,
                y: m.y
            }, function(d) {
                console.log("[BaseTag v14] delete:", d);
            });
        }
            function syncDeleteRoute(routeNote, cb) {
                apiCall({action:"deleteRoute",world:FORCE_WORLD_ID,notes:routeNote}, cb||function(){});
            }
            function syncAddLine(spec, cb) {
                apiCall({action:"addLine",world:FORCE_WORLD_ID,orientation:spec.orientation,fixed:spec.fixed,from:spec.from,to:spec.to,marker:spec.marker,priority:spec.priority||"MED",notes:spec.notes||"",by:myPlayerName,byAlliance:getMyAlliance()||""}, cb||function(){});
            }
            function syncDeleteLine(spec, cb) {
                apiCall({action:"deleteLine",world:FORCE_WORLD_ID,orientation:spec.orientation,fixed:spec.fixed,from:spec.from,to:spec.to}, cb||function(){});
            }

            function syncSetPlayers(playerList, cb) {
                apiCall({ action:"setPlayers", players:JSON.stringify(playerList) }, cb||function(){});
            }
            function syncGetAllowedPlayers(cb) {
                apiCall({ action:"listPlayers" }, cb);
            }
            function syncGetBannedPlayers(cb) {
                apiCall({ action:"listBanned" }, cb);
            }
            function syncGetPendingPlayers(cb) {
                apiCall({ action:"listPending" }, cb);
            }
            function syncGetAccessSnapshot(cb) {
                apiCall({ action:"accessSnapshot" }, cb);
            }
            function syncBanPlayer(name, cb) {
                apiCall({ action:"banPlayer", player:name }, cb||function(){});
            }
            function syncUnbanPlayer(name, cb) {
                apiCall({ action:"unbanPlayer", player:name }, cb||function(){});
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
                if (!mn) {
                    console.warn("[BaseTag v2.19] skipping unsafe color patch for class:", cls);
                    return;
                }

                cls.prototype.__AFWBv14 = true;
                cls.prototype.__AFWBv14Orig = cls.prototype[mn];
                cls.prototype.__AFWBv14Method = mn;

                cls.prototype[mn] = function () {

                    try {

                        const k = key(this.get_RawX(), this.get_RawY());

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
                    const cities=ClientLib.Data.MainData.GetInstance().get_Cities().get_AllCities().d;
                    for(let id in cities) { const c=cities[id]; if(!c||c.__AFWBv14HAF||typeof c.HasAttackFormation!=="function") continue; c.__AFWBv14HAF=true; c.__AFWBv14HAFOrig=c.HasAttackFormation; c.HasAttackFormation=function(tid){try{if(isMarkedById(tid)) return true;}catch(e){} return c.__AFWBv14HAFOrig.apply(c,arguments);}; }
                } catch(e) {}
            }

            // ── Region right-click menu ───────────────────────────────────
            function hookRegionMenu() {
            const menu = webfrontend.gui.region.RegionCityMenu.getInstance();

            menu.addListener("appear", function () {

                try {

                    const sel = getMenuObj(menu);
                    if (!sel) return;

                    const ch = menu.getChildren();
                    if (!ch || !ch[0]) return;

                    const sub = ch[0];

                    // IMPORTANT: copy the children array before removing anything.
                    // getChildren() may be a live collection; removing while iterating it can
                    // skip every second BaseTag control and create duplicate KILL buttons
                    // on subsequent menu opens.
                    const existingMenuChildren = sub.getChildren().slice();
                    existingMenuChildren.forEach(function (c) {
                        try {
                            let remove=false;
                            if(c.getUserData && c.getUserData("AFWBBtn")) remove=true;

                            // Cleanup safety for buttons left by older BaseTag builds.
                            let lbl="";
                            try { if(typeof c.getLabel==="function") lbl=String(c.getLabel()||""); } catch(e) {}
                            if(lbl==="⚡ KILL" || lbl==="✖ REMOVE" || lbl==="BaseTag »") remove=true;

                            if(remove){
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

                    // ---------- Alliance ----------
                    const allianceBtn = new qx.ui.menu.Button("Mark Alliance Base »");
                    const allianceMenu = new qx.ui.menu.Menu();

                    const fastBtn = new qx.ui.menu.Button("FAST");
                    fastBtn.setTextColor("#00ccff");
                    fastBtn.addListener("execute", function () {
                        addMarkFromObj(sel, "KILL", "HIGH");
                    });
                    allianceMenu.add(fastBtn);

                    const killBtn = new qx.ui.menu.Button("🔵 KILL");
                    killBtn.addListener("execute", function () {
                        addMarkFromObj(sel, "KILL", "MED");
                    });
                    allianceMenu.add(killBtn);

                    const ignoreBtn = new qx.ui.menu.Button("IGNORE");
                    ignoreBtn.setTextColor("#ef4444");
                    ignoreBtn.addListener("execute", function () {
                        addMarkFromObj(sel, "IGNORE", "LOW");
                    });
                    allianceMenu.add(ignoreBtn);

                    allianceBtn.setMenu(allianceMenu);
                    am.add(allianceBtn);

                    // ---------- Member ----------
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

                    am.add(new qx.ui.menu.Separator());

                    const rmB = new qx.ui.menu.Button("REMOVE MARK");
                    rmB.addListener("execute", function () {
                        removeMarkFromObj(sel);
                    });
                    am.add(rmB);

                    markBtn.setMenu(am);
                    sub.add(markBtn);

                    // Quick actions directly under BaseTag — no submenu opening required.
                    const quickKillBtn = new qx.ui.form.Button("⚡ KILL");
                    quickKillBtn.setUserData("AFWBBtn", true);
                    quickKillBtn.set({appearance:"button-standard-nod",width:115,height:26,backgroundColor:"#1d4ed8",textColor:"#ffffff"});
                    quickKillBtn.setToolTipText("Quick mark as KILL (blue)");
                    quickKillBtn.addListener("execute", function () {
                        try {
                            const target=getMenuObj(menu);
                            if(!target)return;
                            addMarkFromObj(target,"KILL","MED","");
                        } catch(e){console.error("[BaseTag] quick KILL:",e);}
                    });
                    sub.add(quickKillBtn);

                    const quickRemoveBtn = new qx.ui.form.Button("✖ REMOVE");
                    quickRemoveBtn.setUserData("AFWBBtn", true);
                    quickRemoveBtn.set({appearance:"button-standard-nod",width:115,height:26,backgroundColor:"#991b1b",textColor:"#ffffff"});
                    quickRemoveBtn.setToolTipText("Quick remove BaseTag mark");
                    quickRemoveBtn.addListener("execute", function () {
                        try {
                            const target=getMenuObj(menu);
                            if(!target)return;
                            removeMarkFromObj(target);
                        } catch(e){console.error("[BaseTag] quick REMOVE:",e);}
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

                            // Native Add() path is the one used on this game build.
                            // Set BOTH our full visible name and the devil icon here.
                            try {
                                if (typeof directItem.setLabel === "function") {
                                    directItem.setLabel("TA BaseTag COMMANDER by Maly");
                                }
                            } catch (e) {}

                            try {
                                if (typeof directItem.setIcon === "function") {
                                    directItem.setIcon("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAEQUlEQVR42o1UWWyUZRQ99/u///9npp0OM02nG7WAbZUmLILYaIwd2awLGCEDEeLG+kJSiEaNJpYJRuODSkJIlKDig8RMjTEqYQIaq1AIm2hBCAMUaIelQxc601n/5fpSoCxFz9N9+O7Jd8859xL+A6deX/cRC7lfmz7pnHngz7V1n2587V7v6XrBw3V3JOI1s4mSC/X3pcpDm98qP3J8xZCuXIbDmdF6ByYOPD97CwvZrQpxmtkstFNZFzuU9rpPNh1taWkR8gY1M8hTxF2bPwuPvdT7hHhgwscY54+oR2mN7XQXKwJuu7Qkq8d7/dR1+QXT64up+ZxLWGaZpWkbABxd39YmBAeDCgBE3337lcGmeb8VH4/OUju7Vcep0y+N+/zLHVfKi7/3JRK6erWfrGyGLE3bKEielD73IXbpR6C7DiKVOQMA8PtZtA5/sCiRP1HU2RW4NqHqu65Awxel11KV3Y8GtuHJR741nFIxqyrOyuSQzC162uT+vhkF+44sdxyLBssuXZlreT2564OKYDhsA0C6pvrC+WdmLvv5l8gSSNTYiSRz3nhY3dvxhpHKwip02IXJrHRu2v5B7sUFa7ii4hCcWqyvquwdqio/BQAIh21JRAwA969d2wPgq2hxsU4W2vPugkZz8oO7PK0718lMFvqBjlpDlcAY93j9j32LHbGLU/rGlv5THfnxQ2TzYICIiMVIyzkY1Oqam3MWqbtlgQuO6rHtmSr/IU0qyKvSMpjZe/DvSrgLZdLn6Si/1DsjunL5PAYIwaAAAHFbjCwAELqQEgTE+87b9bW/OqQCYmYwc1Eqoyh9A06r1Jew2YZiCyaAb2h4t3CKIo9tZrMw4r2r5OFji9M5AzZBOIhErKq0nRPJ8ZWHT84dkNIwH5t2AgBQX8+jEhpEVprB3t17Vrni/eMzqmBp2pT3eYasBU27Bn/YGrg6pfYn9nmOb1+y7DwDgkIh+w7C6xEyJXIEJjMxZJjMLGwm2DaZg0mtOhwJqXs7CnNjCvdBylSIyB65cbcQDkeI0oFAZ8pX1OdyF6hgG3mnztnKEjgzOW3wco9VsHHLVna45timmQbRrXLdsthEzACmLlwYTy6d33DtucBKuFxwmjYnn531dbLUF9fzhiL7+2vBXEAM8w7973ItmINBpa75zbMDPs9fUkpS0xny7vx9crp5xXum32uxZcdZ4LQtoI0weHSX2+Jx4pYWoZ+N1euGwRmC4cvmHuJY7FjPU48HsyWeCpHMjCPDlrf3ylHvWihkn2luNhShkEvTtK6GqRtq1r+/n4j4RCg0X4/HZzNTGgdumjkqmJlaAHGR2XVxZlO7XV7L3Y1zIlFm/fD06erN+Qj/G9zYKAGgc+nLq83KOuaayXxu9YpXASDa1KSHg0GFR8TlnhoCQNvwFWfAypf5sz0Ta3aIaZP2MEDfNDQYi1pbLbrdEQD/ArbU7GLTm3uoAAAAAElFTkSuQmCC");
                                }
                            } catch (e) {
                                console.log("[BaseTag] native Scripts icon:", e);
                            }

                            directItem.addListener("execute", function () { openBoardSafe(); });
                            directItem.addListener("click", function () { openBoardSafe(); });
                            scriptsAdded = true;
                            console.log("[BaseTag v2.32] Native Scripts → named + devil icon");
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

                    const item = new qx.ui.menu.Button('TA BaseTag COMMANDER by Maly', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAEQUlEQVR42o1UWWyUZRQ99/u///9npp0OM02nG7WAbZUmLILYaIwd2awLGCEDEeLG+kJSiEaNJpYJRuODSkJIlKDig8RMjTEqYQIaq1AIm2hBCAMUaIelQxc601n/5fpSoCxFz9N9+O7Jd8859xL+A6deX/cRC7lfmz7pnHngz7V1n2587V7v6XrBw3V3JOI1s4mSC/X3pcpDm98qP3J8xZCuXIbDmdF6ByYOPD97CwvZrQpxmtkstFNZFzuU9rpPNh1taWkR8gY1M8hTxF2bPwuPvdT7hHhgwscY54+oR2mN7XQXKwJuu7Qkq8d7/dR1+QXT64up+ZxLWGaZpWkbABxd39YmBAeDCgBE3337lcGmeb8VH4/OUju7Vcep0y+N+/zLHVfKi7/3JRK6erWfrGyGLE3bKEielD73IXbpR6C7DiKVOQMA8PtZtA5/sCiRP1HU2RW4NqHqu65Awxel11KV3Y8GtuHJR741nFIxqyrOyuSQzC162uT+vhkF+44sdxyLBssuXZlreT2564OKYDhsA0C6pvrC+WdmLvv5l8gSSNTYiSRz3nhY3dvxhpHKwip02IXJrHRu2v5B7sUFa7ii4hCcWqyvquwdqio/BQAIh21JRAwA969d2wPgq2hxsU4W2vPugkZz8oO7PK0718lMFvqBjlpDlcAY93j9j32LHbGLU/rGlv5THfnxQ2TzYICIiMVIyzkY1Oqam3MWqbtlgQuO6rHtmSr/IU0qyKvSMpjZe/DvSrgLZdLn6Si/1DsjunL5PAYIwaAAAHFbjCwAELqQEgTE+87b9bW/OqQCYmYwc1Eqoyh9A06r1Jew2YZiCyaAb2h4t3CKIo9tZrMw4r2r5OFji9M5AzZBOIhErKq0nRPJ8ZWHT84dkNIwH5t2AgBQX8+jEhpEVprB3t17Vrni/eMzqmBp2pT3eYasBU27Bn/YGrg6pfYn9nmOb1+y7DwDgkIh+w7C6xEyJXIEJjMxZJjMLGwm2DaZg0mtOhwJqXs7CnNjCvdBylSIyB65cbcQDkeI0oFAZ8pX1OdyF6hgG3mnztnKEjgzOW3wco9VsHHLVna45timmQbRrXLdsthEzACmLlwYTy6d33DtucBKuFxwmjYnn531dbLUF9fzhiL7+2vBXEAM8w7973ItmINBpa75zbMDPs9fUkpS0xny7vx9crp5xXum32uxZcdZ4LQtoI0weHSX2+Jx4pYWoZ+N1euGwRmC4cvmHuJY7FjPU48HsyWeCpHMjCPDlrf3ylHvWihkn2luNhShkEvTtK6GqRtq1r+/n4j4RCg0X4/HZzNTGgdumjkqmJlaAHGR2XVxZlO7XV7L3Y1zIlFm/fD06erN+Qj/G9zYKAGgc+nLq83KOuaayXxu9YpXASDa1KSHg0GFR8TlnhoCQNvwFWfAypf5sz0Ta3aIaZP2MEDfNDQYi1pbLbrdEQD/ArbU7GLTm3uoAAAAAElFTkSuQmCC');
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

            const x = obj.get_RawX(), y = obj.get_RawY();

            console.log("addMarkFromObj", x, y, action, priority);

            const m = {
                world: FORCE_WORLD_ID,
                action: action,
                priority: priority || "MED",
                x: x,
                y: y,
                id: getId(obj),
                name: getObjName(obj),
                type: getObjType(obj),
                level: getLevel(obj),
                alliance: getAlliance(obj),       // target alliance
                byAlliance: getMyAlliance(),        // alliance of player who marked it
                notes: "",
                by: myPlayerName,
                time: new Date().toLocaleString()
            };

            marks[key(x,y)] = m;
            saveLocal(STORAGE_KEY, marks);
            syncUpsert(m);
            patchHasAttackFormation();
            refreshMarkedObjects();
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
                byAlliance: getMyAlliance(),

                notes: "",
                by: myPlayerName,

                time: new Date().toLocaleString()

            };

            saveLocal(MEMBER_STORAGE_KEY, memberMarks);

            refreshMarkedObjects();
        }
            function addMarkManual(x,y,name,type,level,alliance,action,priority,notes) {
                const m={world:FORCE_WORLD_ID,action,priority:priority||"MED",x,y,id:"",name:name||"Manual",type:type||"Unknown",level:String(level||""),alliance:alliance||"",byAlliance:getMyAlliance(),notes:notes||"",by:myPlayerName,time:new Date().toLocaleString()};
                marks[key(x,y)]=m; saveLocal(STORAGE_KEY,marks); syncUpsert(m); patchHasAttackFormation(); refreshMarkedObjects();
            }

            // POI Route Planner bridge — uses the SAME current-world ID as all BaseTag operations.
            function poiSegDist(px,py,ax,ay,bx,by){
                const vx=bx-ax,vy=by-ay,wx=px-ax,wy=py-ay,vv=vx*vx+vy*vy;
                if(vv<=0.000001)return Math.hypot(px-ax,py-ay);
                let q=(wx*vx+wy*vy)/vv;q=Math.max(0,Math.min(1,q));
                return Math.hypot(px-(ax+q*vx),py-(ay+q*vy));
            }
            function poiInside(x,y,route,r){
                if(!Array.isArray(route)||route.length<2)return false;
                for(let i=1;i<route.length;i++)if(poiSegDist(x,y,Number(route[i-1].x),Number(route[i-1].y),Number(route[i].x),Number(route[i].y))<=r)return true;
                return false;
            }
            function poiCollect(route,r){
                const a=[],seen={}; if(!Array.isArray(route)||route.length<2)return a;
                const xs=route.map(p=>Number(p.x)),ys=route.map(p=>Number(p.y));
                const minX=Math.max(0,Math.floor(Math.min(...xs)-r-1)),maxX=Math.ceil(Math.max(...xs)+r+1);
                const minY=Math.max(0,Math.floor(Math.min(...ys)-r-1)),maxY=Math.ceil(Math.max(...ys)+r+1);
                let w=null;try{w=ClientLib.Data.MainData.GetInstance().get_World();}catch(e){}
                if(!w||typeof w.GetObjectFromPosition!=="function")return a;
                for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
                    if(!poiInside(x,y,route,r))continue;
                    let o=null;try{o=w.GetObjectFromPosition(x,y);}catch(e){}
                    if(!o)continue;let ot=null;try{ot=o.Type;}catch(e){}if(ot!==2)continue;
                    const k=key(x,y);if(seen[k])continue;seen[k]=1;
                    a.push({x,y,id:getId(o),name:getObjName(o),type:getObjType(o),level:getLevel(o),alliance:getAlliance(o)});
                }
                return a;
            }

            function poiRouteBatchUpsert(items, callback){
                /*
                 * Batch payload must be sent in the POST BODY.
                 * Putting 50 JSON marks into the query string can exceed the
                 * Apps Script / proxy URL limit and returns an HTML error page
                 * (<!DOCTYPE ...>) instead of JSON.
                 */
                const params = {
                    action: "batchUpsert",
                    world: FORCE_WORLD_ID,
                    _: Date.now(),
                    password: accessPassword || "",
                    marks: JSON.stringify(items)
                };

                const body = Object.keys(params)
                    .map(k => encodeURIComponent(k) + "=" + encodeURIComponent(params[k]))
                    .join("&");

                GM_xmlhttpRequest({
                    method: "POST",
                    url: API_URL,
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
                    },
                    data: body,
                    onload: function(res){
                        let data = null;
                        try {
                            data = JSON.parse(res.responseText);
                        } catch(e) {
                            console.error("BATCH JSON ERROR:", e, res.status, res.finalUrl, res.responseText.substring(0,500));
                            if(callback) callback({ok:false,error:"NON_JSON_RESPONSE",status:res.status});
                            return;
                        }
                        if(callback) callback(data);
                    },
                    onerror: function(err){
                        console.error("BATCH REQUEST ERROR:", err);
                        if(callback) callback({ok:false,error:"REQUEST_ERROR"});
                    }
                });
            }

            function poiRouteSync(payload,progress,done){
                payload=payload||{};
                const route=Array.isArray(payload.route)?payload.route:[];
                const radius=Math.max(1,Number(payload.radius||8));
                const rank=Math.max(1,Number(payload.rank||1));
                const maxLevel=payload.maxLevel==null?null:Number(payload.maxLevel);
                const actualWorld=String(getWorldNumber());
                if(String(payload.world||"")!==actualWorld){
                    if(done)done({ok:false,error:"WORLD_MISMATCH",plannerWorld:String(payload.world||""),baseTagWorld:actualWorld});
                    return;
                }
                let bases=Array.isArray(payload.bases)
                    ? payload.bases.map(b=>({
                        x:Number(b.x),
                        y:Number(b.y),
                        level:Number(b.level||0),
                        id:b.id||"",
                        name:b.name||"Forgotten Base",
                        type:b.type||"Forgotten Base",
                        alliance:b.alliance||""
                    }))
                    : [];

                if(maxLevel!==null&&!isNaN(maxLevel))
                    bases=bases.filter(b=>Number(b.level||0)<=maxLevel);

                if(!bases.length){
                    if(done)done({ok:false,error:"NO_FORGOTTEN_BASES_IN_CORRIDOR",count:0});
                    return;
                }

                const all=bases.map(b=>({
                    world:actualWorld,mark:"KILL",priority:"MED",x:b.x,y:b.y,
                    id:b.id||"",name:b.name||"Forgotten Base",type:b.type||"Forgotten Base",
                    level:b.level||"",alliance:b.alliance||"",byAlliance:getMyAlliance(),
                    notes:"POI ROUTE #"+rank,by:"POI Route Planner"
                }));

                all.forEach(m=>{
                    marks[key(m.x,m.y)]={
                        world:m.world,action:m.mark,priority:m.priority,x:m.x,y:m.y,id:m.id,
                        name:m.name,type:m.type,level:m.level,alliance:m.alliance,
                        byAlliance:m.byAlliance,notes:m.notes,by:m.by,time:new Date().toLocaleString()
                    };
                });
                saveLocal(STORAGE_KEY,marks);patchHasAttackFormation();refreshMarkedObjects();

                const chunks=[];
                for(let i=0;i<all.length;i+=50)chunks.push(all.slice(i,i+50));
                let ci=0,sent=0;
                function sendNext(){
                    if(ci>=chunks.length){if(done)done({ok:true,count:all.length,synced:sent,rank:rank,radius:radius,batches:chunks.length});return;}
                    const chunk=chunks[ci++];
                    poiRouteBatchUpsert(chunk,function(res){
                        if(!res||!res.ok){if(done)done({ok:false,error:(res&&res.error)||"BATCH_FAILED",synced:sent,count:all.length,batch:ci});return;}
                        sent+=chunk.length;
                        if(progress)try{progress({current:sent,total:all.length,batch:ci,batches:chunks.length});}catch(e){}
                        sendNext();
                    });
                }
                sendNext();
            }

            pageWindow.__MALY_BASETAG__={version:"2.28",world:String(getWorldNumber()),syncRouteCorridor:poiRouteSync};
        function removeMarkFromObj(obj) {

            const x = obj.get_RawX();
            const y = obj.get_RawY();
            const k = key(x, y);

            // Czy wpis był wspólny (Alliance)?
            const m = marks[k];

            // Usuń lokalnie wszystko
            delete marks[k];
            delete memberMarks[k];
            delete mySimSaves[k];

            saveLocal(STORAGE_KEY, marks);
            saveLocal(MEMBER_STORAGE_KEY, memberMarks);
            saveLocal(SIM_STORAGE_KEY, mySimSaves);

            // Tylko wspólne wpisy usuwamy z serwera
            if (m) {
                syncDelete(m);
            }

            refreshMarkedObjects();
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
            function getMyAlliance(){
                try {
                    const md = ClientLib.Data.MainData.GetInstance();
                    const a = md && md.get_Alliance ? md.get_Alliance() : null;
                    if (!a) return "";

                    try {
                        if (typeof a.get_Name === "function") {
                            const n = a.get_Name();
                            if (n) return String(n);
                        }
                    } catch(e) {}

                    try {
                        if (a.Name) return String(a.Name);
                        if (a.name) return String(a.name);
                    } catch(e) {}
                } catch(e) {}

                return "";
            }

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
            function refreshOneMarkedCoord(k){
                try{
                    const parts=String(k).split(":");
                    const x=Number(parts[0]), y=Number(parts[1]);
                    if(!isFinite(x)||!isFinite(y)) return;
                    const o=getVisObjAt(x,y); if(!o) return;
                    try{if(typeof o.UpdateColor==="function") o.UpdateColor();}catch(e){}
                    try{if(typeof o.UpdateZoom==="function") o.UpdateZoom();}catch(e){}
                    try{if(typeof o.UiUpdate==="function") o.UiUpdate(0);}catch(e){}
                    try{if(typeof o.VisUpdate==="function") o.VisUpdate(0,0,0);}catch(e){}
                }catch(e){}
            }
            function refreshMarkedKeys(keys){for(let i=0;i<keys.length;i++) refreshOneMarkedCoord(keys[i]);}
            function refreshMarkedObjects(){
                const seen=Object.create(null), keys=[];
                Object.keys(marks).forEach(function(k){if(!seen[k]){seen[k]=true;keys.push(k);}});
                Object.keys(memberMarks).forEach(function(k){if(!seen[k]){seen[k]=true;keys.push(k);}});
                refreshMarkedKeys(keys);
            }
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

            // ── Persistent Commander UI layout ─────────────────────────
            const PANEL_COL_DEFAULTS={time:145,world:55,by:120,byAlliance:95,x:48,y:48,id:105,mark:75,type:115,level:55,name:150,alliance:115,priority:70,notes:150};
            function panelPrefsKey(){
                return "MALY_BASETAG_COMMANDER_UI_V1_"+String(FORCE_WORLD_ID)+"_"+String(myPlayerName||"commander").toLowerCase();
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
                if(panel){try{savePanelBounds(panel);}catch(e){} try{panel.close();panel.destroy();}catch(e){} panel=null;}
                const app=qx.core.Init.getApplication();
                if (!app) throw new Error("Qooxdoo application not ready");

                const win=new qx.ui.window.Window("TA BaseTag COMMANDER by Maly");
                try {
                    win.setIcon("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAYAAAByDd+UAAAHXElEQVR42p1Ve3BU9RX+zu/eu5t9ZLNZAnmHhJAHIUWCITSITXhICq0jOKTtVClTlFaGsVoRKkrdBAdH+3CsrYKU0kqlOGmjzqBFokDCw2FoBaEQMECIeZCQZJMNSTZ79977O/2DxKIlgHz/3d/93fPdc75zvgOMAi4vV7iqSuGqcuWLM2Zvw/r1B9s//dQFAGc3VNRc3Lq5+Hrf+/1+AQAM0LXndF0ygAjgkeeDO3bEek6czolh47up+w49c3HWNx9TZhe3JDz3ytvt03L+0jujoEKdmOPhkvzGRCRQ1+ljCfn5d54/umdPflFZ2alRCdnvF5+0tyuFW7YYZzdsWOQZ4xWXB/vHasuW7tWeePr9jMPHswcGQ5aIdStWVBSUlg7YYr1ovm92vRoKx5Iu/wqfh7mldTF9e+4q+3t73hUL505PWrHqDPv9giorpfol9spKCUB+zsEJtjlLqt2tXSImJQE90b6p+HF5+cDps8f06Gg9kp7a6T55anzfA4s7nLtqErRpd/zN/vwr64zMzEXc3687T19ID+XnrUs+0eBqzM4qBXCmtrZWAJBiJDMAOLXR/8OebVsfUx5d/6LnsyZpdQcHtXNNUj9+fFnqvPtOBvOz33ByxElGxG5Eu6S9rdOpe5yDBx5c/ls43e22GM8+1e3eFYnzXHJOzdsYHBfHwuPZDwClpaUSAAQAoL6eAMApyXJt2/lyTPX7S8huU7WEOFdI14Xr3IWHmobaM/jxlZVDbkfE9/G/EqO7ehXv3oMxbLeFcwBiwBBmJIONoTwyTZd1puEeGYlYX+2Pq4RVVRIAMtb73wkMDPbrE8frgfsXPNX97M8XhTPSwjEnznvU+39ycODOWTLksB0L500wux5d9sFgrIfJ5eSZQNhUyEw4erJszKHji1wtHWOTN+98yjmkq1KxtGsJVQAgopGOlINzZn5oFRX8Om3FyiPN+o922AMBTRIxAr3CsenVtb6Wrqlhh92UesQmDZM8zZ2+lu89UD1UMLkm2N5bpwcC3xHdXeltk7LeNmw20/Il9AIAKioYlZVf6VKASFMZhommf9cl8qbtO30fHS4RDLQ/8uDvndW7F49t7kjptykcpQrSDYsVSyJcNCXYt/GZpdqevT7nvkN+szsQl9JY70UgiOuX9H8zwjBM2u/3q+mFJe1tW7feOxTjDYVsmqnNLKqliDEuTFenVDekhGRYMW4K5WZedi//2bsZr+/Y7jlyMtOtm+4Lz/qXM6DsLylRRyUcSbS0osJiZhItLRqbxpDb7VS8hXc0RqbkvBXljAJJKUEQUATxQEgm/envuTzG19Q8e8arwQlJHdHt3Yr44KNHwCxL6+qsmxFiRFdHaqokTWPVkNSz9Q0Z9ebLvwqlJoIiBjFdVYOEgGVXDdXtiojn1/4jMn3yWYBBQxHPJ4A67Fj0paa5DhsAwAIiTBjSTBNQHBx6aUtBbCCIQVVh4qt9xlKSUDQt/uDRvIG7luwPEUypqUBywvFCIQwGFAKsG2c4HGw8oMDh0PTgFeBK3xqt5sDT3NULqCoNX5NuQdRZkL27aV5xtXQ5YesOqrDbwYKawYzakhLCzcDMBAANzPa2mXNaBsZm8JXcAu5Ly+XupCwOJGdzd0qO7B83QbaX3NN6trd1bnPzuYktNe8s7Li7tO3ytGKj8cyJnGtd7KYaAkAbYDHLMKkKjL5+wzQtScPlBgGSiExLqmOXrHgvsvqXL6TOX/zPSGpSvYRiZOROufDF/N2McMQIZjsdJlRhkilNKIJBJACAmEG6gYhNZXdDY7y3/nyUPSW182NmhzAMIQWLS4DterHVGy1gqq62zOT4I46O7lxlSMcASxAAw2GHGOMh7WIHjCg7B5mld1fNw9zbm8wx0ZKYpXXNPr21klZVSUgJ7cnVa9rn3eXvml30Bz3Oa5BhQlFV7l32g7cGkuMG7GGdpCDYeoKa0nE5RwqhspSsjLLcbziHAJBcWNidtGnThmPbt/9C2u0GhICrb4BsNQd8xuYXlxop8dBCuiSHna3YmP8I0+onIZSvn+Ew9vv9KpeUqFPe/HOuakoHM3NIkJV05tx8dXdtWuDxhx8SaQmaFjEYki+xYeo8rPVtEZbW1zPV1ZmRtpYxURGdmIhZCCi9fTDqDq3P/umqbZcXz1+NBJ8Q3YEUYVkGWdK8bcLazs6rWvSF422mBBFZqmVSz+SsVrFw3koO60qWf8NLjcXTfzOQGJeOKFeaKYQjFTCuda1bJuwaN44BQLm78LNBbzQL04RD00TPpIm70teuq0Z5OfySReYfX1+D114rC0/K3Bgqu3slhu2MRtHyhqgqL1cgCBeffOJ3oQnf4L64dLOjaFZ/w7EDeSPveZSuvC34/X7BAJ1idrcUf6srGJ9pDSVm8ecL7j16itnmBwQzEzNTVXn5/+3Ar40Rb21m9rXOmNU7GJvKenI2N5UtaG1g9jBAI3duhlv+EwboMGAkx3q7BrMUxSqY9CEv//5z2URX2O8XRCRvJc5/AefPiROe2cDIAAAAAElFTkSuQmCC");
                } catch(e) {
                    console.log("[BaseTag] title icon:", e);
                }
                const panelPrefs=loadPanelPrefs();
                const savedWin=panelPrefs.window||{};
                const initialW=Math.max(760,Number(savedWin.width)||1020);
                const initialH=Math.max(500,Number(savedWin.height)||680);
                win.set({width:initialW,height:initialH,allowMaximize:true,showMinimize:false,contentPadding:0,backgroundColor:"#080b14"});
                win.setLayout(new qx.ui.layout.VBox(0));

                // TA/Qooxdoo + Chromium can leave a large stale/black repaint rectangle
                // when a heavy translucent window is moved live over the WebGL/canvas map.
                // Use Qooxdoo's move/resize frame so only a lightweight outline is dragged;
                // the real BaseTag window is repositioned once on pointer release.
                try { if(typeof win.setUseMoveFrame==="function") win.setUseMoveFrame(true); } catch(e) {}
                try { if(typeof win.setUseResizeFrame==="function") win.setUseResizeFrame(true); } catch(e) {}

                // Persist bounds only after movement/resizing settles. This avoids repeated
                // localStorage writes while the pointer is moving and reduces repaint pressure.
                let panelBoundsSaveTimer=null;
                function schedulePanelBoundsSave(){
                    if(panelBoundsSaveTimer)clearTimeout(panelBoundsSaveTimer);
                    panelBoundsSaveTimer=setTimeout(function(){panelBoundsSaveTimer=null;savePanelBounds(win);},700);
                }
                // Position/size persistence only. No scroll forcing, no synthetic resize,
                // no viewport-repair timers while the panel is moved.
                win.addListener("move",schedulePanelBoundsSave);
                win.addListener("resize",schedulePanelBoundsSave);

                // IMPORTANT: BaseTag must be a floating child of the game's Desktop only.
                // Adding qx.ui.window.Window to the application Root can participate in root
                // layout/viewport calculations. When the window is dragged this may move/resize
                // the whole game surface and leave a black strip after the panel is closed.
                let host=null;
                try {
                    if(typeof app.getDesktop==="function") host=app.getDesktop();
                } catch(e) {}
                if(!host || typeof host.add!=="function"){
                    throw new Error("BaseTag: game Desktop not ready; refusing Root fallback to protect game viewport.");
                }

                // Root cause fix: the floating BaseTag window must not enlarge the
                // scrollable overflow area of the TA Desktop when it is intentionally placed
                // partly outside the visible game area. Clip Desktop overflow once; the panel
                // keeps its real off-screen coordinates, but the hidden part cannot change the
                // game's document/layout extent.
                try {
                    const hostEl = host.getContentElement && host.getContentElement();
                    if(hostEl && typeof hostEl.setStyle === "function") {
                        hostEl.setStyle("overflow", "hidden");
                    }
                } catch(e) {}

                host.add(win);
                panel=win;

                let allArr=[], fast=[], kills=[], ignores=[], members=[], simmed=[];
                function refreshPanelData(){
                    allArr = Object.entries(marks).map(function(e){
                        const mk=e[0], mv=e[1];
                        return Object.assign({},mv,{k:mk,simSaved:!!mySimSaves[mk]});
                    });
                    fast = allArr.filter(function(m){return m.action==="KILL"&&m.priority==="HIGH";});
                    kills = allArr.filter(function(m){return m.action==="KILL"&&m.priority!=="HIGH";});
                    ignores = allArr.filter(function(m){return m.action==="IGNORE";});
                    members = Object.entries(memberMarks).map(function(e){
                        return Object.assign({},e[1],{k:e[0],action:"MEMBER",mark:"MEMBER",priority:""});
                    });
                    simmed = allArr.filter(function(m){return m.simSaved;});
                }
                refreshPanelData();
                // Stats bar
                const statsBar=new qx.ui.container.Composite(new qx.ui.layout.HBox(14)); statsBar.set({padding:[5,12],backgroundColor:"#0a0f1e"});
                const statValueLabels={};
                function statLbl(val,label,col,keyName){
                    const box=new qx.ui.container.Composite(new qx.ui.layout.VBox(0));
                    box.set({padding:[2,8],backgroundColor:"#0d1529"});
                    const vl=new qx.ui.basic.Label(String(val));
                    vl.set({font:"bold",textColor:col||"#00ccff",alignX:"center"});
                    const ll=new qx.ui.basic.Label(label);
                    ll.set({textColor:"#334155",alignX:"center"});
                    box.add(vl);box.add(ll);
                    if(keyName)statValueLabels[keyName]=vl;
                    return box;
                }
                statsBar.add(statLbl(allArr.length,"TOTAL","#94a3b8","ALL"));
                statsBar.add(statLbl(fast.length,"FAST","#00ccff","FAST"));
                statsBar.add(statLbl(kills.length,"KILL","#2563eb","KILL"));
                statsBar.add(statLbl(ignores.length,"IGNORE","#ef4444","IGNORE"));
                statsBar.add(statLbl(members.length,"MEMBER","#ffffff","MEMBER"));
                statsBar.add(statLbl(simmed.length,"SIM ✓","#a78bfa","SIM"));
                const flex1=new qx.ui.core.Spacer(); flex1.setWidth(1); statsBar.add(flex1,{flex:1});
                const apiLbl=new qx.ui.basic.Label(apiDown?"⚠ Sheet offline":"● Sheet live"); apiLbl.set({textColor:apiDown?"#ef4444":"#22c55e",alignY:"middle"}); statsBar.add(apiLbl);
                const playerLbl=new qx.ui.basic.Label("Commander: "+myPlayerName); playerLbl.set({textColor:"#475569",alignY:"middle"}); statsBar.add(playerLbl);
                win.add(statsBar);

                // Tab bar
                const tabBar=new qx.ui.container.Composite(new qx.ui.layout.HBox(0)); tabBar.set({backgroundColor:"#060910"});
                const tabMarks=new qx.ui.form.Button("⚔ BaseTag"); tabMarks.set({appearance:"button-standard-nod",height:30,backgroundColor:"#0a2a4a",textColor:"#00ccff"});
                const tabAccess=new qx.ui.form.Button("👥 Alliance Access"); tabAccess.set({appearance:"button-standard-nod",height:30,backgroundColor:"#1e293b",textColor:"#cbd5e1"});
                tabBar.add(tabMarks); tabBar.add(tabAccess);
                win.add(tabBar);

                // Pages
                const pageMarks=new qx.ui.container.Composite(new qx.ui.layout.VBox(0)); pageMarks.set({backgroundColor:"#080b14"});
                const pageAccess=new qx.ui.container.Composite(new qx.ui.layout.VBox(0)); pageAccess.set({backgroundColor:"#080b14",visibility:"excluded"});

                function showTab(tab) {
                    if(tab==="marks"){
                        pageMarks.setVisibility("visible"); pageAccess.setVisibility("excluded");
                        tabMarks.setBackgroundColor("#0a2a4a"); tabMarks.setTextColor("#00ccff");
                        tabAccess.setBackgroundColor("#162033"); tabAccess.setTextColor("#94a3b8");
                        savePanelPrefsPatch({tab:"marks"});
                    } else {
                        pageMarks.setVisibility("excluded"); pageAccess.setVisibility("visible");
                        tabAccess.setBackgroundColor("#0a2a4a"); tabAccess.setTextColor("#00ccff");
                        tabMarks.setBackgroundColor("#162033"); tabMarks.setTextColor("#94a3b8");
                        savePanelPrefsPatch({tab:"access"});
                        loadAccessPage();
                    }
                }
                tabMarks.addListener("execute",function(){showTab("marks");});
                tabAccess.addListener("execute",function(){showTab("access");});

                // ── BaseTag page ────────────────────────────────────────
                const toolbar=new qx.ui.container.Composite(new qx.ui.layout.HBox(6)); toolbar.set({padding:[5,10],backgroundColor:"#0a0f1e"});
                let currentFilter=String(panelPrefs.filter||"ALL").toUpperCase(); let contentArea=null;
                if(["ALL","FAST","KILL","IGNORE","MEMBER","SIM"].indexOf(currentFilter)===-1)currentFilter="ALL";
                let sortColumn=panelPrefs.sortColumn||"time", sortDirection=Number(panelPrefs.sortDirection)||-1;
                let columnWidths=Object.assign({},PANEL_COL_DEFAULTS,panelPrefs.columns||{});
                let columnRuntimeWidgets={};
                function rememberColumns(){savePanelPrefsPatch({columns:columnWidths});}
                function sortableValue(m,col){
                    if(col==="time"){
                        const raw=String(m.time||"").trim();
                        if(!raw) return 0;

                        // Google Sheet format: yyyy-MM-dd HH:mm:ss
                        let mt=raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
                        if(mt){
                            return new Date(
                                Number(mt[1]), Number(mt[2])-1, Number(mt[3]),
                                Number(mt[4]), Number(mt[5]), Number(mt[6])
                            ).getTime();
                        }

                        // Older/local BaseTag entries, e.g. Thu Aug 27 2026 12:27:00...
                        const parsed=Date.parse(raw);
                        return Number.isFinite(parsed) ? parsed : 0;
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

        let currentPage=Math.max(1,Number(panelPrefs.page)||1);
        let pageSize=Number(panelPrefs.pageSize)||100;
        if([50,100,200].indexOf(pageSize)===-1)pageSize=100;
        let pagerBar=null,pagerInfo=null,btnPrevPage=null,btnNextPage=null,pageSizeSelect=null;

        function updatePanelCounters(){
            refreshPanelData();
            try{statValueLabels.ALL.setValue(String(allArr.length));}catch(e){}
            try{statValueLabels.FAST.setValue(String(fast.length));}catch(e){}
            try{statValueLabels.KILL.setValue(String(kills.length));}catch(e){}
            try{statValueLabels.IGNORE.setValue(String(ignores.length));}catch(e){}
            try{statValueLabels.MEMBER.setValue(String(members.length));}catch(e){}
            try{statValueLabels.SIM.setValue(String(simmed.length));}catch(e){}
            try{btnAll.setLabel("All ("+allArr.length+")");}catch(e){}
            try{btnFast.setLabel("FAST ("+fast.length+")");}catch(e){}
            try{btnKill.setLabel("🔵 KILL ("+kills.length+")");}catch(e){}
            try{btnIgnore.setLabel("IGNORE ("+ignores.length+")");}catch(e){}
            try{btnMember.setLabel("MEMBER ("+members.length+")");}catch(e){}
            try{btnSim.setLabel("🟣 SIM ("+simmed.length+")");}catch(e){}
        }

        function setFilter(f,activeBtn){
            currentFilter=f;
            [btnAll,btnFast,btnKill,btnIgnore,btnMember,btnSim].forEach(function(b){
                b.setBackgroundColor("#1e293b");
                b.setTextColor("#cbd5e1");
            });
            activeBtn.setBackgroundColor("#0a2a4a");
            activeBtn.setTextColor("#00ccff");
            currentPage=1;
            savePanelPrefsPatch({filter:currentFilter,page:currentPage});
            rebuildContent();
        }

        btnAll.addListener("execute",function(){setFilter("ALL",btnAll);});
        btnFast.addListener("execute",function(){setFilter("FAST",btnFast);});
        btnKill.addListener("execute",function(){setFilter("KILL",btnKill);});
        btnIgnore.addListener("execute",function(){setFilter("IGNORE",btnIgnore);});
        btnMember.addListener("execute",function(){setFilter("MEMBER",btnMember);});
        btnSim.addListener("execute",function(){setFilter("SIM",btnSim);});

        [btnAll,btnFast,btnKill,btnIgnore,btnMember,btnSim].forEach(function(b){b.setBackgroundColor("#1e293b");b.setTextColor("#cbd5e1");});
        const initialFilterButton={ALL:btnAll,FAST:btnFast,KILL:btnKill,IGNORE:btnIgnore,MEMBER:btnMember,SIM:btnSim}[currentFilter]||btnAll;
        initialFilterButton.setBackgroundColor("#0a2a4a"); initialFilterButton.setTextColor("#00ccff");

        toolbar.add(btnAll);
        toolbar.add(btnFast);
        toolbar.add(btnKill);
        toolbar.add(btnIgnore);
        toolbar.add(btnMember);
        toolbar.add(btnSim);
                const flex2=new qx.ui.core.Spacer(); flex2.setWidth(1); toolbar.add(flex2,{flex:1});
                let addFormOpen=false; let addFormContainer=null;
                const btnAddToggle=makeBtn("➕ Add Manually","#0f172a","#94a3b8",120);
                btnAddToggle.addListener("execute",function(){addFormOpen=!addFormOpen; if(addFormContainer) addFormContainer.setVisibility(addFormOpen?"visible":"excluded"); btnAddToggle.setLabel(addFormOpen?"✕ Cancel Add":"➕ Add Manually");});
                toolbar.add(btnAddToggle);
                const btnDeleteRoute=makeBtn("🗑 POI Route","#0f172a","#ef4444",105);
                btnDeleteRoute.setToolTipText("Delete one POI ROUTE from BaseTag and Google Sheet");
                btnDeleteRoute.addListener("execute",function(){
                    const routes={};
                    Object.values(marks).forEach(function(m){
                        const mm=String(m.notes||"").match(/^POI ROUTE\s*#(\d+)$/i);
                        if(mm)routes[mm[1]]=true;
                    });
                    const available=Object.keys(routes).sort(function(a,b){return Number(a)-Number(b);});
                    if(!available.length){alert("No POI ROUTE marks found on this world.");return;}
                    const chosen=prompt("Delete POI Route\n\nAvailable routes: "+available.join(", ")+"\n\nEnter route number:",available[0]);
                    if(chosen===null)return;
                    const n=String(chosen).trim(),note="POI ROUTE #"+n;
                    if(!routes[n]){alert(note+" is not present on this world.");return;}
                    const count=Object.keys(marks).filter(function(k){return String(marks[k].notes||"")===note;}).length;
                    if(!confirm("Delete "+note+"?\n\nThis will remove "+count+" marks from BaseTag and Google Sheet."))return;
                    Object.keys(marks).forEach(function(k){if(String(marks[k].notes||"")===note){delete marks[k];delete mySimSaves[k];}});
                    saveLocal(STORAGE_KEY,marks);saveLocal(SIM_STORAGE_KEY,mySimSaves);refreshMarkedObjects();
                    btnDeleteRoute.setLabel("Deleting…");
                    syncDeleteRoute(note,function(d){
                        btnDeleteRoute.setLabel("🗑 POI Route");
                        if(!d||!d.ok)alert("Route delete failed: "+((d&&d.error)||"unknown error"));
                        rebuildContent();
                    });
                });
                toolbar.add(btnDeleteRoute);
                const btnSync=makeBtn("↻ Sync","#0f172a","#94a3b8",70);
                btnSync.addListener("execute",function(){
                    syncFromServer();
                    btnSync.setLabel("Syncing…");
                    setTimeout(function(){btnSync.setLabel("↻ Sync");rebuildContent();},1400);
                });
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

                // Bulk line tools: explicit user action only; no background work.
                const lineToolBar=new qx.ui.container.Composite(new qx.ui.layout.HBox(8));
                lineToolBar.set({padding:[4,10],backgroundColor:"#0b1220"});
                const btnAddLine=makeBtn("➕ Add line","#162033","#22c55e",100);
                const btnDeleteLine=makeBtn("🗑 Delete line","#162033","#ef4444",110);
                const lineStatus=new qx.ui.basic.Label(""); lineStatus.set({textColor:"#64748b",alignY:"middle"});
                lineToolBar.add(btnAddLine); lineToolBar.add(btnDeleteLine); lineToolBar.add(lineStatus);
                pageMarks.add(lineToolBar);

                const scroll=new qx.ui.container.Scroll(); scroll.set({backgroundColor:"#080b14",minHeight:400});
                const outerVbox=new qx.ui.container.Composite(new qx.ui.layout.VBox(6)); outerVbox.set({padding:10,backgroundColor:"#080b14"});

                let lineMode="ADD";
                const lineFormContainer=new qx.ui.container.Composite(new qx.ui.layout.VBox(6));
                lineFormContainer.set({padding:10,backgroundColor:"#0a0f1e",visibility:"excluded"});
                const lineTitle=new qx.ui.basic.Label("Line tools"); lineTitle.set({textColor:"#00ccff",font:"bold"}); lineFormContainer.add(lineTitle);
                const lineRow=new qx.ui.container.Composite(new qx.ui.layout.HBox(8));
                const lineDir=new qx.ui.form.SelectBox(); lineDir.set({width:180});
                [{l:"Horizontal — fixed Y",m:"H"},{l:"Vertical — fixed X",m:"V"}].forEach(function(o){const i=new qx.ui.form.ListItem(o.l);i.setModel(o.m);lineDir.add(i);});
                const lineFixed=new qx.ui.form.TextField(); lineFixed.set({width:90,placeholder:"364"});
                const lineRange=new qx.ui.form.TextField(); lineRange.set({width:120,placeholder:"645-633"});
                const lineFromBtn=makeBtn("From","#1e293b","#22c55e",70);
                const lineToBtn=makeBtn("To","#1e293b","#00ccff",70);
                let lineFromPoint=null, lineToPoint=null;

                function getSelectedMapCoords(){
                    // Prefer the same selected region object BaseTag already uses for its map menu.
                    try{
                        const menu=webfrontend.gui.region.RegionCityMenu.getInstance();
                        const obj=getMenuObj(menu);
                        if(obj&&typeof obj.get_RawX==="function"&&typeof obj.get_RawY==="function"){
                            return {x:Number(obj.get_RawX()),y:Number(obj.get_RawY())};
                        }
                    }catch(e){}
                    // Fallback: game's current region selection.
                    try{
                        const app=qx.core.Init.getApplication();
                        const region=app&&app.getPlayArea?app.getPlayArea().getRegion():null;
                        const sel=region&&typeof region.get_Selection==="function"?region.get_Selection():null;
                        if(sel&&typeof sel.get_RawX==="function"&&typeof sel.get_RawY==="function"){
                            return {x:Number(sel.get_RawX()),y:Number(sel.get_RawY())};
                        }
                    }catch(e){}
                    return null;
                }

                function applyLineEndpoints(){
                    if(!lineFromPoint||!lineToPoint)return false;
                    const dx=Math.abs(lineToPoint.x-lineFromPoint.x),dy=Math.abs(lineToPoint.y-lineFromPoint.y);
                    // Auto-detect horizontal/vertical line. Exact straight line wins;
                    // otherwise use the dominant axis and the FROM point as fixed coordinate.
                    let orientation,fixed,a,b;
                    if(lineFromPoint.y===lineToPoint.y || dx>=dy){
                        orientation="H"; fixed=lineFromPoint.y; a=lineFromPoint.x; b=lineToPoint.x;
                    }else{
                        orientation="V"; fixed=lineFromPoint.x; a=lineFromPoint.y; b=lineToPoint.y;
                    }
                    const wanted=orientation==="H"?"H":"V";
                    try{
                        const items=lineDir.getSelectables(true);
                        for(let i=0;i<items.length;i++){
                            if(items[i].getModel()===wanted){lineDir.setSelection([items[i]]);break;}
                        }
                    }catch(e){}
                    lineFixed.setValue(String(fixed));
                    lineRange.setValue(String(a)+"-"+String(b));
                    lineStatus.setTextColor("#22c55e");
                    lineStatus.setValue("Detected "+(orientation==="H"?"horizontal":"vertical")+" line: "+(orientation==="H"?(Math.min(a,b)+"-"+Math.max(a,b)+":"+fixed):(fixed+":"+Math.min(a,b)+"-"+Math.max(a,b))));
                    return true;
                }

                function captureLinePoint(which){
                    const p=getSelectedMapCoords();
                    if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)){
                        lineStatus.setTextColor("#ef4444");
                        lineStatus.setValue("No map target selected. Click a base/object on the map first.");
                        return;
                    }
                    if(which==="FROM"){lineFromPoint=p;lineFromBtn.setLabel("From "+p.x+":"+p.y);}
                    else{lineToPoint=p;lineToBtn.setLabel("To "+p.x+":"+p.y);}
                    lineStatus.setTextColor("#94a3b8");
                    lineStatus.setValue(which+" = "+p.x+":"+p.y+(lineFromPoint&&lineToPoint?" · detecting line…":""));
                    if(lineFromPoint&&lineToPoint)applyLineEndpoints();
                }
                lineFromBtn.addListener("execute",function(){captureLinePoint("FROM");});
                lineToBtn.addListener("execute",function(){captureLinePoint("TO");});
                const lineMarker=new qx.ui.form.SelectBox(); lineMarker.set({width:100});
                ["FAST","KILL","IGNORE"].forEach(function(v){const i=new qx.ui.form.ListItem(v);i.setModel(v);lineMarker.add(i);});
                const lineNotes=new qx.ui.form.TextField(); lineNotes.set({width:180,placeholder:"Notes (optional)"});
                function lineField(label,widget){const b=new qx.ui.container.Composite(new qx.ui.layout.VBox(2));const l=new qx.ui.basic.Label(label);l.set({textColor:"#64748b"});b.add(l);b.add(widget);return b;}
                lineRow.add(lineField("Direction",lineDir));
                lineRow.add(lineField("Fixed coord",lineFixed));
                lineRow.add(lineField("Range",lineRange));
                lineRow.add(lineField("Pick on map",lineFromBtn));
                lineRow.add(lineField("Pick on map",lineToBtn));
                lineRow.add(lineField("Marker",lineMarker));
                lineRow.add(lineField("Notes",lineNotes));
                lineFormContainer.add(lineRow);
                const lineHelp=new qx.ui.basic.Label('Manual: fixed 364 + range 645-633. Or select a map target → From, select the other end → To. BaseTag detects horizontal/vertical line automatically.');
                lineHelp.set({textColor:"#475569"}); lineFormContainer.add(lineHelp);
                const lineExec=makeBtn("Add line","#166534","#ffffff",120); lineFormContainer.add(lineExec);
                outerVbox.add(lineFormContainer);

                function openLineForm(mode){
                    lineMode=mode;
                    lineFromPoint=null; lineToPoint=null;
                    lineFromBtn.setLabel("From"); lineToBtn.setLabel("To");
                    lineFormContainer.setVisibility("visible");
                    lineTitle.setValue(mode==="ADD"?"➕ Add line":"🗑 Delete line");
                    lineExec.setLabel(mode==="ADD"?"Add line":"Delete line");
                    lineExec.setBackgroundColor(mode==="ADD"?"#166534":"#991b1b");
                    lineMarker.setEnabled(mode==="ADD"); lineNotes.setEnabled(mode==="ADD");
                }
                btnAddLine.addListener("execute",function(){openLineForm("ADD");});
                btnDeleteLine.addListener("execute",function(){openLineForm("DELETE");});
                lineExec.addListener("execute",function(){
                    const orientation=lineDir.getSelection()[0]?lineDir.getSelection()[0].getModel():"H";
                    const fixed=Number(String(lineFixed.getValue()||"").trim());
                    const rm=String(lineRange.getValue()||"").trim().match(/^(\d+)\s*-\s*(\d+)$/);
                    if(!Number.isInteger(fixed)||!rm){lineStatus.setTextColor("#ef4444");lineStatus.setValue("Invalid fixed coord or range. Use e.g. 645-633.");return;}
                    const a=Number(rm[1]),b=Number(rm[2]),lo=Math.min(a,b),hi=Math.max(a,b);
                    if(hi-lo+1>1000){lineStatus.setTextColor("#ef4444");lineStatus.setValue("Line is too long (max 1000 coords).");return;}
                    const marker=lineMarker.getSelection()[0]?lineMarker.getSelection()[0].getModel():"KILL";
                    const spec={orientation:orientation,fixed:fixed,from:lo,to:hi,marker:marker,priority:marker==="FAST"?"HIGH":"MED",notes:lineNotes.getValue()||""};
                    const desc=(orientation==="H"?(lo+"-"+hi+":"+fixed):(fixed+":"+lo+"-"+hi));
                    if(lineMode==="DELETE"){
                        const localCount=Object.keys(marks).filter(function(k){const m=marks[k],x=Number(m.x),y=Number(m.y);return orientation==="H"?(y===fixed&&x>=lo&&x<=hi):(x===fixed&&y>=lo&&y<=hi);}).length;
                        if(!confirm("Delete line "+desc+"?\n\nThis will remove all shared BaseTag markers in that coordinate range. Local match count: "+localCount))return;
                        lineExec.setEnabled(false); lineStatus.setTextColor("#94a3b8"); lineStatus.setValue("Deleting line…");
                        syncDeleteLine(spec,function(d){
                            lineExec.setEnabled(true);
                            if(!d||!d.ok){lineStatus.setTextColor("#ef4444");lineStatus.setValue("Delete failed: "+((d&&d.error)||"unknown error"));return;}
                            Object.keys(marks).forEach(function(k){const m=marks[k],x=Number(m.x),y=Number(m.y);if(orientation==="H"?(y===fixed&&x>=lo&&x<=hi):(x===fixed&&y>=lo&&y<=hi)){delete marks[k];delete mySimSaves[k];}});
                            saveLocal(STORAGE_KEY,marks);saveLocal(SIM_STORAGE_KEY,mySimSaves);refreshMarkedObjects();
                            lineStatus.setTextColor("#22c55e");lineStatus.setValue("Deleted "+Number(d.deleted||0)+" markers from "+desc);
                            rebuildContent();
                        });
                    }else{
                        if(!confirm("Add "+marker+" line "+desc+"?\n\n"+(hi-lo+1)+" coordinates will be inserted/updated."))return;
                        lineExec.setEnabled(false); lineStatus.setTextColor("#94a3b8"); lineStatus.setValue("Adding line…");
                        syncAddLine(spec,function(d){
                            lineExec.setEnabled(true);
                            if(!d||!d.ok){lineStatus.setTextColor("#ef4444");lineStatus.setValue("Add failed: "+((d&&d.error)||"unknown error"));return;}
                            for(let n=lo;n<=hi;n++){
                                const x=orientation==="H"?n:fixed,y=orientation==="H"?fixed:n;
                                marks[key(x,y)]={world:FORCE_WORLD_ID,x:x,y:y,id:"",action:marker==="IGNORE"?"IGNORE":"KILL",mark:marker==="IGNORE"?"IGNORE":"KILL",name:"Manual "+marker+" "+x+":"+y,type:"Manual",level:"",alliance:"",byAlliance:getMyAlliance()||"",priority:marker==="FAST"?"HIGH":"MED",notes:spec.notes||"",by:myPlayerName,time:new Date().toString()};
                            }
                            saveLocal(STORAGE_KEY,marks);refreshMarkedObjects();
                            lineStatus.setTextColor("#22c55e");lineStatus.setValue("Added/updated "+Number(d.count||0)+" markers on "+desc);
                            rebuildContent();
                        });
                    }
                });

                // Manual add form
                addFormContainer=new qx.ui.container.Composite(new qx.ui.layout.VBox(6)); addFormContainer.set({padding:10,backgroundColor:"#0a0f1e",visibility:"excluded"});
                const addTitle=new qx.ui.basic.Label("➕ Add Target Manually"); addTitle.set({textColor:"#00ccff",font:"bold"}); addFormContainer.add(addTitle);
                const addRow1=new qx.ui.container.Composite(new qx.ui.layout.HBox(8));
                const addRow2=new qx.ui.container.Composite(new qx.ui.layout.HBox(8));
                function addField(label,widget){const box=new qx.ui.container.Composite(new qx.ui.layout.VBox(2)); const lbl=new qx.ui.basic.Label(label); lbl.set({textColor:"#334155"}); box.add(lbl); box.add(widget); return box;}
                const fX=new qx.ui.form.TextField(); fX.set({width:80,placeholder:"X coord"});
                const fY=new qx.ui.form.TextField(); fY.set({width:80,placeholder:"Y coord"});
                const fName=new qx.ui.form.TextField(); fName.set({width:160,placeholder:"Name *"});
                const fAlliance=new qx.ui.form.TextField(); fAlliance.set({width:80,placeholder:"Tag"});
                const fLevel=new qx.ui.form.TextField(); fLevel.set({width:60,placeholder:"Lvl"});
                const fNotes=new qx.ui.form.TextField(); fNotes.set({width:200,placeholder:"Notes (optional)"});
                const fType=new qx.ui.form.SelectBox(); fType.set({width:130});
                ["Player Base","Forgotten Base","Camp/Outpost","POI","Unknown"].forEach(t=>{const i=new qx.ui.form.ListItem(t); i.setModel(t); fType.add(i);});
                const fAction=new qx.ui.form.SelectBox(); fAction.set({width:90});
                ACTIONS.forEach(a=>{const i=new qx.ui.form.ListItem(a); i.setModel(a); fAction.add(i);});
                const fPri=new qx.ui.form.SelectBox(); fPri.set({width:80});
                PRIORITIES.forEach(p=>{const i=new qx.ui.form.ListItem(p); i.setModel(p); fPri.add(i);});
                addRow1.add(addField("X *",fX)); addRow1.add(addField("Y *",fY)); addRow1.add(addField("Name *",fName)); addRow1.add(addField("Alliance",fAlliance)); addRow1.add(addField("Level",fLevel));
                addRow2.add(addField("Type",fType)); addRow2.add(addField("Action",fAction)); addRow2.add(addField("Priority",fPri)); addRow2.add(addField("Notes",fNotes));
                addFormContainer.add(addRow1); addFormContainer.add(addRow2);
                const addErrLbl=new qx.ui.basic.Label(""); addErrLbl.set({textColor:"#ef4444"}); addFormContainer.add(addErrLbl);
                const addBtnRow=new qx.ui.container.Composite(new qx.ui.layout.HBox(8));
                const btnAddSubmit=makeBtn("➕ Add to Board","#0a2a4a","#00ccff",140);
                btnAddSubmit.addListener("execute",function(){
                    const x=parseInt(fX.getValue()||""), y=parseInt(fY.getValue()||""), nm=(fName.getValue()||"").trim();
                    addErrLbl.setValue("");
                    if(isNaN(x)||isNaN(y)){addErrLbl.setValue("X and Y coords are required."); return;}
                    if(!nm){addErrLbl.setValue("Name is required."); return;}
                    addMarkManual(x,y,nm, fType.getSelection()[0]?fType.getSelection()[0].getModel():"Unknown", fLevel.getValue()||"", fAlliance.getValue()||"", fAction.getSelection()[0]?fAction.getSelection()[0].getModel():"KILL", fPri.getSelection()[0]?fPri.getSelection()[0].getModel():"MED", fNotes.getValue()||"");
                    rebuildContent();
                    addErrLbl.setTextColor("#22c55e"); addErrLbl.setValue("Added. Panel kept open.");
                });
                addBtnRow.add(btnAddSubmit); addFormContainer.add(addBtnRow);
                outerVbox.add(addFormContainer);
                pagerBar=new qx.ui.container.Composite(new qx.ui.layout.HBox(8));
                pagerBar.set({padding:[4,6],backgroundColor:"#0a0f1e"});
                btnPrevPage=makeBtn("◀ Prev","#162033","#cbd5e1",80);
                btnNextPage=makeBtn("Next ▶","#162033","#cbd5e1",80);
                pagerInfo=new qx.ui.basic.Label(""); pagerInfo.set({textColor:"#94a3b8",alignY:"middle"});
                const pagerFlex=new qx.ui.core.Spacer(); pagerBar.add(btnPrevPage); pagerBar.add(btnNextPage); pagerBar.add(pagerInfo);
                pagerBar.add(pagerFlex,{flex:1});
                const psLbl=new qx.ui.basic.Label("Rows/page"); psLbl.set({textColor:"#64748b",alignY:"middle"}); pagerBar.add(psLbl);
                pageSizeSelect=new qx.ui.form.SelectBox(); pageSizeSelect.set({width:75});
                [50,100,200].forEach(function(v){const it=new qx.ui.form.ListItem(String(v));it.setModel(v);pageSizeSelect.add(it);if(v===pageSize)pageSizeSelect.setSelection([it]);});
                pagerBar.add(pageSizeSelect);
                btnPrevPage.addListener("execute",function(){if(currentPage>1){currentPage--;savePanelPrefsPatch({page:currentPage});rebuildContent();}});
                btnNextPage.addListener("execute",function(){currentPage++;savePanelPrefsPatch({page:currentPage});rebuildContent();});
                pageSizeSelect.addListener("changeSelection",function(){const s=pageSizeSelect.getSelection()[0];if(!s)return;pageSize=Number(s.getModel())||100;currentPage=1;savePanelPrefsPatch({pageSize:pageSize,page:1});rebuildContent();});
                outerVbox.add(pagerBar);

                contentArea=new qx.ui.container.Composite(new qx.ui.layout.VBox(4)); outerVbox.add(contentArea,{flex:1});
                scroll.add(outerVbox); pageMarks.add(scroll,{flex:1});

                // Legend
                const legendBar=new qx.ui.container.Composite(new qx.ui.layout.HBox(16)); legendBar.set({padding:[4,12],backgroundColor:"#060910"});
                function legendItem(color,text){const row=new qx.ui.container.Composite(new qx.ui.layout.HBox(4)); const dot=new qx.ui.basic.Label("●"); dot.set({textColor:color}); const lbl=new qx.ui.basic.Label(text); lbl.set({textColor:"#1e3a5a"}); row.add(dot);row.add(lbl); return row;}
                legendBar.add(legendItem("#00ccff","Cyan = FAST")); legendBar.add(legendItem("#2563eb","Blue = KILL")); legendBar.add(legendItem("#ef4444","Red = IGNORE")); legendBar.add(legendItem("#ffffff","White = MEMBER"));
                const flex3=new qx.ui.core.Spacer(); legendBar.add(flex3,{flex:1});
                const vLbl=new qx.ui.basic.Label("v2.70 · World "+FORCE_WORLD_ID); vLbl.set({textColor:"#0f1a2e"}); legendBar.add(vLbl);
                pageMarks.add(legendBar);

                // ── Alliance Access page ──────────────────────────────────
                let accessLoaded=false;
                let checkboxMap={};  // playerName -> qx.ui.form.CheckBox

                function loadAccessPage() {
                    // Always refresh from server. A newly registered PENDING player
                    // must appear without restarting Commander.
                    accessLoaded=true;
                    buildAccessPage();
                }

                function buildAccessPage() {
                    pageAccess.removeAll();
                    checkboxMap={};

                    const header=new qx.ui.basic.Label("👥 Alliance Access Control");
                    header.set({textColor:"#00ccff",font:"bold",padding:[10,12,4,12]});
                    pageAccess.add(header);

                    const subhdr=new qx.ui.basic.Label("Tick a member to grant access. Only ticked players can see BaseTag marks. Untick to revoke.");
                    subhdr.set({textColor:"#475569",padding:[0,12,8,12]});
                    pageAccess.add(subhdr);

                    // Toolbar
                    const aTbar=new qx.ui.container.Composite(new qx.ui.layout.HBox(8)); aTbar.set({padding:[4,12]});
                    const btnSelectAll=makeBtn("✓ Select All","#0f172a","#22c55e",100);
                    const btnClearAll=makeBtn("✕ Clear All","#0f172a","#ef4444",90);
                    const btnSaveAccess=makeBtn("💾 Save Access List","#1d4ed8","#ffffff",150);
                    const btnRefreshAccess=makeBtn("↻ Refresh","#0f172a","#00ccff",90);
                    const statusLbl=new qx.ui.basic.Label(""); statusLbl.set({textColor:"#64748b",alignY:"middle",marginLeft:10});
                    aTbar.add(btnSelectAll); aTbar.add(btnClearAll); aTbar.add(btnSaveAccess); aTbar.add(btnRefreshAccess); aTbar.add(statusLbl);
                    btnRefreshAccess.addListener("execute",function(){ buildAccessPage(); });
                    pageAccess.add(aTbar);

                    // Member list area
                    const aScroll=new qx.ui.container.Scroll(); aScroll.set({backgroundColor:"#080b14"});
                    const aVbox=new qx.ui.container.Composite(new qx.ui.layout.VBox(2)); aVbox.set({padding:[6,12]});

                    const loadingLbl=new qx.ui.basic.Label("Loading alliance members and access list…"); loadingLbl.set({textColor:"#334155",padding:10}); aVbox.add(loadingLbl);
                    aScroll.add(aVbox); pageAccess.add(aScroll,{flex:1});

                    // One accessSnapshot response contains ALLOWED / PENDING / BANNED.
                    // Render it once; no legacy three-reply gate.
                    let accessAllowedData=null;
                    let accessPendingData=null;
                    let accessBannedData=null;

                    function finishAccessLoad() {

                        const data=accessAllowedData;
                        const pendingData=accessPendingData;
                        const banData=accessBannedData;

                        const allowedSet=new Set();
                        if(data&&data.ok&&Array.isArray(data.players)) {
                            data.players.forEach(function(p){ allowedSet.add(String(p).trim().toLowerCase()); });
                        }

                        const pendingSet=new Set();
                        if(!pendingData || pendingData.ok!==true) {
                            console.error("[BaseTag Access] listPending failed:", pendingData);
                        }
                        if(pendingData&&pendingData.ok&&Array.isArray(pendingData.players)) {
                            pendingData.players.forEach(function(p){ pendingSet.add(String(p).trim().toLowerCase()); });
                        }

                        const bannedSet=new Set();
                        if(banData&&banData.ok&&Array.isArray(banData.players)) {
                            banData.players.forEach(function(p){ bannedSet.add(String(p).trim().toLowerCase()); });
                        }

                        aVbox.removeAll();
                        checkboxMap={};

                        // Access page must never depend on the game's fragile/obfuscated
                        // alliance-member collection. The Players sheet is the authoritative
                        // access list; merge live game members only when they are available.
                        const memberMap={};
                        if(data&&data.ok&&Array.isArray(data.players)) {
                            data.players.forEach(function(n){
                                n=String(n||"").trim();
                                if(n) memberMap[n.toLowerCase()]=n;
                            });
                        }
                        if(pendingData&&pendingData.ok&&Array.isArray(pendingData.players)) {
                            pendingData.players.forEach(function(n){
                                n=String(n||"").trim();
                                if(n) memberMap[n.toLowerCase()]=n;
                            });
                        }
                        getAllianceMembers().forEach(function(n){
                            n=String(n||"").trim();
                            if(n) memberMap[n.toLowerCase()]=n;
                        });
                        if(myPlayerName) memberMap[String(myPlayerName).toLowerCase()]=myPlayerName;

                        const members=Object.keys(memberMap)
                            .map(function(k){return memberMap[k];})
                            .sort(function(a,b){return a.toLowerCase().localeCompare(b.toLowerCase());});

                        if(!members.length) {
                            const noMembers=new qx.ui.basic.Label("⚠ No players found in the BaseTag access list.");
                            noMembers.set({textColor:"#f59e0b",padding:10,rich:true}); aVbox.add(noMembers);
                        } else {
                            // Column headers
                            const hRow=new qx.ui.container.Composite(new qx.ui.layout.HBox(0)); hRow.set({padding:[2,8],backgroundColor:"#0a0f1e"});
                            const hAccess=new qx.ui.basic.Label("Access"); hAccess.set({textColor:"#1e3a5a",width:60,font:"bold"});
                            const hName=new qx.ui.basic.Label("Player Name"); hName.set({textColor:"#1e3a5a",width:260,font:"bold"});
                            const hAllow=new qx.ui.basic.Label("Approve"); hAllow.set({textColor:"#1e3a5a",width:90,font:"bold"});
                            const hBan=new qx.ui.basic.Label("Ban"); hBan.set({textColor:"#1e3a5a",width:90,font:"bold"});
                            hRow.add(hAccess); hRow.add(hName); hRow.add(hAllow); hRow.add(hBan); aVbox.add(hRow);

                            members.forEach(function(name, idx) {
                                const isBanned=bannedSet.has(name.toLowerCase());
                                const isAllowed=!isBanned && allowedSet.has(name.toLowerCase());
                                const row=new qx.ui.container.Composite(new qx.ui.layout.HBox(8));
                                row.set({padding:[4,8],backgroundColor:idx%2===0?"#0a0f1e":"#080b14"});
                                const cb=new qx.ui.form.CheckBox(); cb.setValue(isAllowed); cb.set({width:50}); if(isBanned) cb.setEnabled(false);
                                const isPending=!isBanned && pendingSet.has(name.toLowerCase());
                                const nameLbl=new qx.ui.basic.Label(
                                    esc(name)+(isPending?"  [PENDING]":(isAllowed?"  [ALLOWED]":(isBanned?"  [BANNED]":"")))
                                );
                                nameLbl.set({textColor:isBanned?"#ef4444":(isPending?"#f59e0b":(isAllowed?"#22c55e":"#c8d8e8")),alignY:"middle",width:260});

                                const allowBtn=makeBtn(isAllowed?"ALLOWED":"ALLOW",isAllowed?"#14532d":"#166534","#ffffff",80);
                                allowBtn.setEnabled(!isBanned && !isAllowed);
                                allowBtn.addListener("execute",function(){
                                    statusLbl.setValue("Approving "+name+"…");
                                    const next=[];
                                    for(const n in checkboxMap) {
                                        if(checkboxMap[n].getValue() || n===name) next.push(n);
                                    }
                                    if(!next.includes(myPlayerName)) next.push(myPlayerName);
                                    syncSetPlayers(next,function(d){
                                        if(d&&d.ok){
                                            statusLbl.setValue("✓ "+name+" ALLOWED");
                                            statusLbl.setTextColor("#22c55e");
                                            buildAccessPage();
                                        } else {
                                            statusLbl.setValue("✗ Approval failed");
                                            statusLbl.setTextColor("#ef4444");
                                        }
                                    });
                                });

                                const banBtn=makeBtn(isBanned?"UNBAN":"BAN",isBanned?"#14532d":"#7f1d1d","#ffffff",80);
                                if(name===myPlayerName) { nameLbl.setTextColor("#00ccff"); nameLbl.setValue(esc(name)+" (you)"); cb.setValue(true); allowBtn.setEnabled(false); banBtn.setEnabled(false); }
                                banBtn.addListener("execute",function(){
                                    statusLbl.setValue((isBanned?"Unbanning ":"Banning ")+name+"…");
                                    const done=function(d){
                                        if(d&&d.ok){ accessLoaded=false; buildAccessPage(); }
                                        else { statusLbl.setValue("✗ Operation failed"); statusLbl.setTextColor("#ef4444"); }
                                    };
                                    if(isBanned) syncUnbanPlayer(name,done); else syncBanPlayer(name,done);
                                });
                                row.add(cb); row.add(nameLbl); row.add(allowBtn); row.add(banBtn);
                                aVbox.add(row);
                                checkboxMap[name]=cb;
                            });
                        }

                        // Wire up buttons now that checkboxes exist
                        btnSelectAll.addListener("execute",function(){ for(const n in checkboxMap) checkboxMap[n].setValue(true); });
                        btnClearAll.addListener("execute",function(){
                            for(const n in checkboxMap) {
                                // Always keep commander checked
                                if(n!==myPlayerName) checkboxMap[n].setValue(false);
                            }
                        });
                        btnSaveAccess.addListener("execute",function(){
                            const allowed=[];
                            for(const n in checkboxMap) { if(checkboxMap[n].getValue()) allowed.push(n); }
                            // Always include commander
                            if(!allowed.includes(myPlayerName)) allowed.push(myPlayerName);
                            statusLbl.setValue("Saving…"); statusLbl.setTextColor("#64748b");
                            syncSetPlayers(allowed,function(d){
                                if(d&&d.ok) {
                                    statusLbl.setValue("✓ Saved "+allowed.length+" players");
                                    statusLbl.setTextColor("#22c55e");
                                } else {
                                    statusLbl.setValue("✗ Save failed");
                                    statusLbl.setTextColor("#ef4444");
                                }
                                setTimeout(function(){statusLbl.setValue("");},3000);
                            });
                        });
                    }

                    // One Apps Script execution instead of three. This removes
                    // duplicate Commander auth + repeated spreadsheet reads on page open.
                    syncGetAccessSnapshot(function(d){
                        if(d&&d.ok){
                            accessAllowedData={ok:true,players:Array.isArray(d.allowed)?d.allowed:[]};
                            accessPendingData={ok:true,players:Array.isArray(d.pending)?d.pending:[]};
                            accessBannedData={ok:true,players:Array.isArray(d.banned)?d.banned:[]};
                        } else {
                            accessAllowedData=d||{ok:false};
                            accessPendingData=d||{ok:false};
                            accessBannedData=d||{ok:false};
                        }
                        finishAccessLoad();
                    });
                }

                win.add(pageMarks,{flex:1});
                win.add(pageAccess,{flex:1});
                win.open();
                try { win.show(); } catch (e) {}
                try { win.setActive(true); } catch (e) {}
                try {
                    if(Number.isFinite(Number(savedWin.left))&&Number.isFinite(Number(savedWin.top))) win.moveTo(Number(savedWin.left),Number(savedWin.top));
                    else win.moveTo(Math.max(10,Math.floor((window.innerWidth-initialW)/2)),Math.max(40,Math.floor((window.innerHeight-initialH)/2)));
                } catch (e) {}
                const startTab=requestedPanelTab||panelPrefs.tab||"marks";
                requestedPanelTab=null;
                showTab(startTab==="access"?"access":"marks");

                // Build marks content
                function priSort(a,b){return ({HIGH:0,MED:1,LOW:2}[a.priority]??1)-({HIGH:0,MED:1,LOW:2}[b.priority]??1);}
                function rebuildContent() {
                    updatePanelCounters();
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
                    // The tabs above already define FAST/KILL/IGNORE/MEMBER/SIM.
                    // Keep the table flat: one header and one sortable list, no repeated sections.
                    const groups = [{
                        label: currentFilter,
                        rows: pageRows
                    }];
                    groups.forEach(function(group){
                        if(!group.rows.length) return;
                        columnRuntimeWidgets={};
                        const hdrRow=new qx.ui.container.Composite(new qx.ui.layout.HBox(0)); hdrRow.set({backgroundColor:"#0a0f1e",padding:[2,6]});
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
                            wrap.set({width:Number(columnWidths[col])||PANEL_COL_DEFAULTS[col]||80,height:26}); registerColumnWidget(col,wrap);
                            const bt=new qx.ui.form.Button(txt+(sortColumn===col?(sortDirection===1?" ▲":" ▼"):""));
                            bt.set({appearance:"button-standard-nod",backgroundColor:"#0a0f1e",textColor:sortColumn===col?"#00ccff":"#64748b",height:26,padding:[0,3]});
                            bt.addListener("execute",function(){
                                if(sortColumn===col)sortDirection*=-1;
                                else{sortColumn=col;sortDirection=(col==="time"||col==="level"||col==="x"||col==="y")?-1:1;}
                                savePanelPrefsPatch({sortColumn:sortColumn,sortDirection:sortDirection}); rebuildContent();
                            });
                            wrap.add(bt,{flex:1});
                            const grip=new qx.ui.core.Widget(); grip.set({width:5,height:26,cursor:"col-resize",backgroundColor:"#263449"});
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
                        const delHdr=new qx.ui.basic.Label("Delete"); delHdr.set({textColor:"#1e3a5a",width:55,font:"bold",alignY:"middle"}); hdrRow.add(delHdr);
                        contentArea.add(hdrRow);

                        group.rows.forEach(function(m,idx){
                            const isMember=(m.action==="MEMBER" || m.mark==="MEMBER");
                            const rowBg=m.action==="KILL"?(idx%2===0?"#140808":"#110606"):(idx%2===0?"#0f1105":"#0d0f04");
                            const row=new qx.ui.container.Composite(new qx.ui.layout.HBox(0)); row.set({backgroundColor:rowBg,padding:[3,6],cursor:"pointer"});
                            row.setToolTipText("Click row to center map on ["+m.x+":"+m.y+"]");
                            (function(cx,cy){row.addListener("click",function(){jumpToMapCoords(cx,cy);});})(m.x,m.y);
                            function cell(txt,col,color){const l=new qx.ui.basic.Label(esc(String(txt==null?"":txt)));l.set({textColor:color||"#c8d8e8",width:Number(columnWidths[col])||PANEL_COL_DEFAULTS[col]||80,alignY:"middle",height:24});registerColumnWidget(col,l);row.add(l);}
                            cell(m.time||"","time","#64748b"); cell(m.world||FORCE_WORLD_ID,"world","#64748b"); cell(m.by||"","by","#64748b");
                            cell(m.byAlliance||"","byAlliance","#64748b"); cell(m.x,"x","#94a3b8"); cell(m.y,"y","#94a3b8"); cell(m.id||"","id","#475569");
                            cell(m.action||m.mark||"","mark",m.action==="IGNORE"?"#ef4444":(m.priority==="HIGH"?"#00ccff":"#3b82f6"));
                            cell(m.type||"","type","#475569"); cell(m.level||"","level","#fbbf24"); cell(m.name||"","name",m.simSaved?"#a78bfa":"#c8d8e8");
                            cell(m.alliance||"","alliance","#475569"); cell(m.priority||"","priority","#94a3b8");

                            if(isMember){
                                cell("LOCAL","notes","#ffffff");
                                const dc=new qx.ui.container.Composite(new qx.ui.layout.HBox(0));dc.set({width:55,alignY:"middle"});
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
                                        try{contentArea.remove(row);row.destroy();}catch(ex){}
                                        updatePanelCounters();
                                        // If this was the last row on the page, rebuild only the current page.
                                        try{if(contentArea.getChildren().length<=2)rebuildContent();}catch(ex){}
                                    });
                                })(m.k);
                                dc.add(rb);row.add(dc);
                            }else{
                                const nf=new qx.ui.form.TextField(m.notes||"");nf.set({width:Number(columnWidths.notes)||150,height:22,placeholder:"Add note…",backgroundColor:"#0d1529",textColor:"#94a3b8"});registerColumnWidget("notes",nf);
                                nf.addListener("click",function(e){try{e.stopPropagation();}catch(ex){}});
                                (function(k){nf.addListener("blur",function(){if(!marks[k])return;marks[k].notes=nf.getValue()||"";saveLocal(STORAGE_KEY,marks);syncUpsert(marks[k]);});})(m.k);
                                row.add(nf);
                                const dc=new qx.ui.container.Composite(new qx.ui.layout.HBox(0));dc.set({width:55,alignY:"middle"});
                                const rb=makeBtn("✖","#b91c1c","#ffffff",42);rb.addListener("click",function(e){try{e.stopPropagation();}catch(ex){}});
                                (function(k,cm){rb.addListener("execute",function(){
                                    if(!marks[k])return;
                                    delete marks[k];delete mySimSaves[k];
                                    saveLocal(STORAGE_KEY,marks);saveLocal(SIM_STORAGE_KEY,mySimSaves);
                                    syncDelete(cm);refreshMarkedObjects();
                                    try{contentArea.remove(row);row.destroy();}catch(ex){}
                                    updatePanelCounters();
                                    try{if(contentArea.getChildren().length<=2)rebuildContent();}catch(ex){}
                                });})(m.k,{x:m.x,y:m.y,world:m.world,action:m.action,priority:m.priority,name:m.name,type:m.type,level:m.level,alliance:m.alliance,notes:m.notes,by:m.by});
                                dc.add(rb);row.add(dc);
                            }
                            contentArea.add(row);
                        });

                        const sp = new qx.ui.core.Spacer(1,8);
                        contentArea.add(sp);

                    });

                }

                rebuildContent();

            }
            function copyBoardText() {

            const lines = [
                "TA BaseTag COMMANDER by Maly v14",
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

    // v2.44 — shared password removed. Commander starts directly.
    try {
        const gameWindow = (typeof unsafeWindow !== "undefined" && unsafeWindow) ? unsafeWindow : window;
        pageMain(gameWindow, "", GM_xmlhttpRequest);
    } catch (e) {
        console.error("[BaseTag Commander] startup failed:", e);
    }

})();
