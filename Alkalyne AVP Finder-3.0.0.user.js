// ==UserScript==
// @name            Alkalyne AVP Finder
// @author          Alkalyne
// @description     Find new OP
// @include         https://cncapp*.alliances.commandandconquer.com/*/index.aspx*
// @grant           GM_xmlhttpRequest
// @grant           GM_updatingEnabled
// @grant           unsafeWindow
// @version         3.0.0
// ==/UserScript==

/* globals qx, ClientLib */
var setupAVPFinder = function() {
    var AF = window.AF || {};

    AF.util = {
        url: function(player, endpoint) {
            return AF.util.URL + player + endpoint;
        },

        waitForLoad: function(callback) {
            var waitFunc = function() {
                AF.util.waitForLoad(callback);
            };

            if (typeof qx === 'undefined') {
                return window.setTimeout(waitFunc, 1000);
            }

            var a = qx.core.Init.getApplication();
            if (a === null || a === undefined) {
                return window.setTimeout(waitFunc, 1000);
            }

            var mb = qx.core.Init.getApplication().getMenuBar();
            if (mb === null || mb === undefined) {
                return window.setTimeout(waitFunc, 1000);
            }

            var md = ClientLib.Data.MainData.GetInstance();
            if (md === null || md === undefined) {
                return window.setTimeout(waitFunc, 1000);
            }

            var player = md.get_Player();
            if (player === null || player === undefined) {
                return window.setTimeout(waitFunc, 1000);
            }

            if (player.get_Name() === '') {
                return window.setTimeout(waitFunc, 1000);
            }

            return callback();
        },

        _g: function(k, r, q, m) {
            var p = [];
            var o = k.toString();
            var n = o.replace(/\s/gim, '');
            p = n.match(r);
            var l;
            for (l = 1; l < (m + 1); l++) {
                if (p !== null && p[l].length === 6) {
                    console.debug(q, l, p[l]);
                } else {
                    if (p !== null && p[l].length > 0) {
                        console.warn(q, l, p[l]);
                    } else {
                        console.error('Error - ', q, l, 'not found');
                        console.warn(q, n);
                    }
                }
            }
            return p;
        }
    };

    window.AF = AF;
};

var AF_MODULES = window.AF_MODULES = [];
AF_MODULES.push(setupAVPFinder);


/* Begin: client/modules/basescanner.js */
/* globals qx, ClientLib, phe */
var avpFinder = function() {
    var MAX_FAILS = 25;
    var AF = window.AF || {};

    var AvpFinder;

    AF.AvpFinder = AvpFinder = {
        _patched: false,
        _bases: [],
		gridWidth : null,
		gridHeight : null,
		tunnelMarkerWidth : null,
		tunnelMarkerHeight : null,
		regionZoomFactor : null,
		tunnelMarkerList : null,
		tunnelInfluenceRange : null,
        scan: function() {
            if (AvpFinder._patched === false) {
                PatchClientLib.patch();
            }

            if (AvpFinder._scanning){
                return;
            }

            AvpFinder._bases = [];

            AvpFinder._scanning = true;

            AvpFinder.index = -1;
            AvpFinder._toScanMap = {};
            AvpFinder._toScan = [];

			var selectedBase = ClientLib.Data.MainData.GetInstance().get_Cities().get_CurrentOwnCity().get_Id();
			console.log(selectedBase);
			/*AvpFinder.getNearByBases(selectedBase);*/
            var allCities = ClientLib.Data.MainData.GetInstance().get_Cities().get_AllCities().d;
            //var id = ClientLib.Data.MainData.GetInstance().get_Cities().get_CurrentCity(); //Renvoi -1
			
			var selectedBase = allCities[selectedBase];
                if (selectedBase === undefined) {
                    throw new Error('unable to find base: ' + selectedBaseID);
                }
			this.removeTunnelMarkers();
			this.tunnelMarkerList = [];
			
            AvpFinder.getNearByBases(selectedBase);
			/*for (var selectedBaseID in allCities) {
                if (!allCities.hasOwnProperty(selectedBaseID) ) {
                    continue;
                }
				console.log("base ID "+selectedBaseID);
                var selectedBase = allCities[selectedBaseID];
                if (selectedBase === undefined) {
                    throw new Error('unable to find base: ' + selectedBaseID);
                }

                AvpFinder.getNearByBases(selectedBase);
            }*/
			AvpFinder._scanning = false;
        },

        // selectionChange: function(from, to){
        //     if (to === null){
        //         return;
        //     }
        // },
		getNearByBases: function(base) {
            var x = base.get_PosX();
            var y = base.get_PosY();
			
            var maxAttack = ClientLib.Data.MainData.GetInstance().get_Server().get_MaxAttackDistance() - 1;
            var world = ClientLib.Data.MainData.GetInstance().get_World();
			this.getRegionZoomFactorAndSetMarkerSize();
            var toScanCount = 0;
			var worldId = ClientLib.Data.MainData.GetInstance().get_Server().get_WorldId();
            for (var scanY = y - 10; scanY <= y + 10; scanY++) {
                for (var scanX = x - 10; scanX <= x + 10; scanX++) {
                    var distX = Math.abs(x - scanX);
                    var distY = Math.abs(y - scanY);
                    var distance = Math.sqrt((distX * distX) + (distY * distY));
                    // too far away to scan
                    if (distance >= maxAttack) {
                        continue;
                    }
                    // already scanning this base from another city.
                    if (AvpFinder._toScanMap[scanX + ':' + scanY] !== undefined) {
                        continue;
                    }

                    var object = world.GetObjectFromPosition(scanX, scanY);
                    // Nothing to scan
                    if (object === null) {
                        continue;
                    }


                    // Object isnt a NPC Base/Camp/Outpost
                    if (/*object.Type !== ClientLib.Data.WorldSector.ObjectType.NPCBase &&*/object.Type !== ClientLib.Data.WorldSector.ObjectType.NPCCamp) {
                        continue;
                    }

                    if (typeof object.getCampType === 'function' && object.getCampType() === ClientLib.Data.Reports.ENPCCampType.Destroyed) {
                        continue;
                    }

                    // Cached
                    var offlineBase = AvpFinder.getOfflineBase(scanX, scanY);
					
                    if (offlineBase !== null && offlineBase.id === object.getID()) {
                        /*delete offlineBase.obj;
                        AvpFinder._bases.push(offlineBase);*/
                        continue;
                    }
					AvpFinder.addMarker(scanX,scanY,"#06ff00");
					
					var scanBase = {
                        x: scanX,
                        y: scanY,
                        level: object.getLevel(),
                        id: object.getID(),
                        distance: distance
                    };
					
					localStorage.setItem('scanAVP-'+worldId+'-' + scanX + ':' + scanY, JSON.stringify(scanBase));
					

                }
            }

            console.log('Found ' + toScanCount + ' new bases to scan from:' + base.get_Name());

        },

		screenPosFromWorldPosX : function (x) {
			try {
				return ClientLib.Vis.VisMain.GetInstance().ScreenPosFromWorldPosX(x * this.gridWidth);
			} catch (e) {
				console.log(e);
			}
		},

		getRegionZoomFactorAndSetMarkerSize : function () {
			try {
				this.gridWidth = ClientLib.Vis.VisMain.GetInstance().get_Region().get_GridWidth();
				this.gridHeight = ClientLib.Vis.VisMain.GetInstance().get_Region().get_GridHeight();
				this.regionZoomFactor = ClientLib.Vis.VisMain.GetInstance().get_Region().get_ZoomFactor();
				this.tunnelMarkerWidth = this.regionZoomFactor * this.gridWidth * 0.50;
				this.tunnelMarkerHeight = this.tunnelMarkerWidth * 0.59;
			} catch (e) {
				console.log(e);
			}
		},
					
		screenPosFromWorldPosY : function (y) {
			try {
				return ClientLib.Vis.VisMain.GetInstance().ScreenPosFromWorldPosY(y * this.gridHeight);
			} catch (e) {
				console.log(e);
			}
		},
					
		addMarker : function (tunnelX, tunnelY, color) {
						try {
							console.log("adding marqueur at " + tunnelX + ":" + tunnelY);
							var tunnelMarker = new qx.ui.container.Composite(new qx.ui.layout.HBox(5)).set({
									decorator : new qx.ui.decoration.Decorator(-15, "solid", "#000000").set({
										backgroundColor : color
									}),
									width : this.tunnelMarkerWidth,
									height : this.tunnelMarkerHeight,
									opacity : 0.5
								});

							qx.core.Init.getApplication().getDesktop().addAfter(tunnelMarker, qx.core.Init.getApplication().getBackgroundArea(), {
								left : this.screenPosFromWorldPosX(tunnelX),
								top : this.screenPosFromWorldPosY(tunnelY)
							});
							this.tunnelMarkerList.push({
								element : tunnelMarker,
								x : tunnelX,
								y : tunnelY
							});
							
							//this.removeTunnelMarkers();
						} catch (e) {
							console.log(e);
						}
					},
					
		removeTunnelMarkers : function () {
			try {
				if (this.tunnelMarkerList!=undefined){
					if (this.tunnelMarkerList.length > 0) {
						for (var i = 0; i < this.tunnelMarkerList.length; i++) {
							qx.core.Init.getApplication().getDesktop().remove(this.tunnelMarkerList[i].element);
						}
						this.tunnelMarkerList = [];
					}
				} else {
					//console.log("Aucun marqueur ? Supprimer");
				}
			} catch (e) {
				console.log(e);
			}
		},
			
		repositionMarkers : function () {
			try {
				if (this.tunnelMarkerList!=undefined){
					for (var i = 0; i < this.tunnelMarkerList.length; i++) {
						this.tunnelMarkerList[i].element.setDomLeft(this.screenPosFromWorldPosX(this.tunnelMarkerList[i].x));
						this.tunnelMarkerList[i].element.setDomTop(this.screenPosFromWorldPosY(this.tunnelMarkerList[i].y));
					}
				} else {
					//console.log("Aucun marqueur ? bouger");
				}
			} catch (e) {
				console.log(e);
			}
		},

		resizeMarkers : function () {
			try {
				if (this.tunnelMarkerList!=undefined){
					this.getRegionZoomFactorAndSetMarkerSize();
					for (var i = 0; i < this.tunnelMarkerList.length; i++) {
						this.tunnelMarkerList[i].element.setWidth(this.tunnelMarkerWidth);
						this.tunnelMarkerList[i].element.setHeight(this.tunnelMarkerHeight);
					}
				} else {
					//console.log("Aucun marqueur ? redimensionner");
				}
			} catch (e) {
				console.log(e);
			}
		},
					
        abort: function() {
            AvpFinder._abort = true;
        },


        isScanning: function() {
            return AvpFinder._scanning === true;
        },

        printScanResults: function(base) {
            AvpFinder._button.setLabel(('   ' + AvpFinder.index).slice(-3) + '/' + AvpFinder._toScan.length);
            console.log('[' + ('   ' + AvpFinder.index).slice(-3) + '/' + AvpFinder._toScan.length + ']\t' + base.x + ':' + base.y + ' ' + base.layout + ' (' + base.failCount + ')');
        },

        setCurrentBase: function(baseID) {
            var allCities = ClientLib.Data.MainData.GetInstance().get_Cities().get_AllCities().d;
            var selectedBase = allCities[baseID];

            ClientLib.Vis.VisMain.GetInstance().CenterGridPosition(selectedBase.get_PosX(), selectedBase.get_PosY());
            ClientLib.Vis.VisMain.GetInstance().Update();
            ClientLib.Vis.VisMain.GetInstance().ViewUpdate();
            AvpFinder._lastBaseID = baseID;
        },

        getOfflineBase: function(x, y) {
            var world = ClientLib.Data.MainData.GetInstance().get_Server().get_WorldId();
            var base = localStorage.getItem('scanAVP-'+world+'-' + x + ':' + y);
            if (base !== null) {
                return JSON.parse(base);
            }
            return null;
        }


    };


    var PatchClientLib = {
        _g: function(k, r, q, m) {
            var p = [];
            var o = k.toString();
            var n = o.replace(/\s/gim, '');
            p = n.match(r);
            var l;
            for (l = 1; l < (m + 1); l++) {
                if (p !== null && p[l].length === 6) {
                    console.debug(q, l, p[l]);
                } else {
                    if (p !== null && p[l].length > 0) {
                        console.warn(q, l, p[l]);
                    } else {
                        console.error('Error - ', q, l, 'not found');
                        console.warn(q, n);
                    }
                }
            }
            return p;
        },

        patch: function() {
            if (AvpFinder._patched) {
                return;
            }

            var t = ClientLib.Data.WorldSector.WorldObjectCity.prototype;
            var re = /this\.(.{6})=\(?\(?g>>8\)?\&.*d\+=f;this\.(.{6})=\(/;
            var y = PatchClientLib._g(t.$ctor, re, ClientLib.Data.WorldSector.WorldObjectCity, 2);
            if (y !== null && y[1].length === 6) {
                t.getLevel = function() {
                    return this[y[1]];
                };
            } else {
                console.error('Error - ClientLib.Data.WorldSector.WorldObjectCity.Level undefined');
            }
            if (y !== null && y[2].length === 6) {
                t.getID = function() {
                    return this[y[2]];
                };
            } else {
                console.error('Error - ClientLib.Data.WorldSector.WorldObjectCity.ID undefined');
            }

            t = ClientLib.Data.WorldSector.WorldObjectNPCBase.prototype;
            re = /100\){0,1};this\.(.{6})=Math.floor.*d\+=f;this\.(.{6})=\(/;
            var x = PatchClientLib._g(t.$ctor, re, 'ClientLib.Data.WorldSector.WorldObjectNPCBase', 2);
            if (x !== null && x[1].length === 6) {
                t.getLevel = function() {
                    return this[x[1]];
                };
            } else {
                console.error('Error - ClientLib.Data.WorldSector.WorldObjectNPCBase.Level undefined');
            }
            if (x !== null && x[2].length === 6) {
                t.getID = function() {
                    return this[x[2]];
                };
            } else {
                console.error('Error - ClientLib.Data.WorldSector.WorldObjectNPCBase.ID undefined');
            }

            t = ClientLib.Data.WorldSector.WorldObjectNPCCamp.prototype;
            re = /100\){0,1};this\.(.{6})=Math.floor.*this\.(.{6})=\(*g\>\>(22|0x16)\)*\&.*=-1;\}this\.(.{6})=\(/;
            var w = PatchClientLib._g(t.$ctor, re, 'ClientLib.Data.WorldSector.WorldObjectNPCCamp', 4);
            if (w !== null && w[1].length === 6) {
                t.getLevel = function() {
                    return this[w[1]];
                };
            } else {
                console.error('Error - ClientLib.Data.WorldSector.WorldObjectNPCCamp.Level undefined');
            }
            if (w !== null && w[2].length === 6) {
                t.getCampType = function() {
                    return this[w[2]];
                };
            } else {
                console.error('Error - ClientLib.Data.WorldSector.WorldObjectNPCCamp.CampType undefined');
            }
            if (w !== null && w[4].length === 6) {
                t.getID = function() {
                    return this[w[4]];
                };
            } else {
                console.error('Error - ClientLib.Data.WorldSector.WorldObjectNPCCamp.ID undefined');
            }

            AvpFinder._patched = true;
        }
    };

    var makeButton = function() {
        qx.Class.define('AF.AvpFinder.main', {
            type: 'singleton',
            extend: qx.core.Object,
            members: {
                buttonScan: null,
                initialize: function() {
                    this.buttonScan = new qx.ui.form.Button('New OP ?');
					console.log(ClientLib.Data.MainData.GetInstance().get_World().GetWorldSectorByCoords(20, 20));
                    this.buttonScan.set({
                        width: 100,
                        appearance: 'button-bar-center',
                        toolTipText: 'New OP ?'
                    });
                    AvpFinder._button = this.buttonScan;
					phe.cnc.Util.attachNetEvent(ClientLib.Vis.VisMain.GetInstance().get_Region(), "PositionChange", ClientLib.Vis.PositionChange, AvpFinder, AvpFinder.repositionMarkers);
					phe.cnc.Util.attachNetEvent(ClientLib.Vis.VisMain.GetInstance().get_Region(), "ZoomFactorChange", ClientLib.Vis.ZoomFactorChange, AvpFinder, AvpFinder.resizeMarkers);
                   
  				    this.buttonScan.addListener('click', this.scan, this);
                    var mainBar = qx.core.Init.getApplication().getUIItem(ClientLib.Data.Missions.PATH.BAR_MENU);
                    mainBar.getChildren()[1].addAt(this.buttonScan, 8, {
                        top: 0,
                        right: 0
                    });
                    console.log('New AVP ? Button added');

                },

                scan: function() {
                    if (AvpFinder.isScanning()) {
                        return AvpFinder.abort();
                    }
                    AvpFinder.scan();
                }
            }

        });

        window.AF.AvpFinder.main.getInstance().initialize();
        // phe.cnc.Util.attachNetEvent(ClientLib.Vis.VisMain.GetInstance(), "SelectionChange", ClientLib.Vis.SelectionChange, AvpFinder, AvpFinder.selectionChange);

    };

    AF.util.waitForLoad(function() {
        console.log('AF: Starting module [AvpFinder]');
        makeButton();
    });
};


var AF_MODULES = window.AF_MODULES || [];
AF_MODULES.push(avpFinder);/* End: client/modules/basescanner.js */
/* Begin: client/modules/basescount.js */
/* globals ClientLib, qx, webfrontend */
var baseCounter = function() {
    var AF = window.AF || {};
    var BaseCounter;

    AF.BaseCounter = BaseCounter = {
        name: 'BaseCounter',

        pasteOutput: function(x, y, baseCount, baseData) {
            var input = qx.core.Init.getApplication().getChat().getChatWidget().getEditable();
            var dom = input.getContentElement().getDomElement();

            var output = [];
            output.push(dom.value.substring(0, dom.selectionStart));
            output.push('[[coords]' + x + ':' + y + '[/coords]] Found ' + baseCount + ' Bases - ' + baseData);
            output.push(dom.value.substring(dom.selectionEnd, dom.value.length));

            input.setValue(output.join(' '));
        },

        countBases: function(x, y, paste) {
            var levelCount = [];
            var count = 0;
            var maxAttack = ClientLib.Data.MainData.GetInstance().get_Server().get_MaxAttackDistance();
            var world = ClientLib.Data.MainData.GetInstance().get_World();
            for (var scanY = y - 10; scanY <= y + 10; scanY++) {
                for (var scanX = x - 10; scanX <= x + 10; scanX++) {
                    var distX = Math.abs(x - scanX);
                    var distY = Math.abs(y - scanY);
                    var distance = Math.sqrt((distX * distX) + (distY * distY));
                    // too far away to scan
                    if (distance >= maxAttack) {
                        continue;
                    }


                    var object = world.GetObjectFromPosition(scanX, scanY);
                    // Nothing to scan
                    if (object === null) {
                        continue;
                    }


                    // Object isnt a NPC Base/Camp/Outpost
                    if (object.Type !== ClientLib.Data.WorldSector.ObjectType.NPCBase) {
                        continue;
                    }

                    if (typeof object.getCampType === 'function' && object.getCampType() === ClientLib.Data.Reports.ENPCCampType.Destroyed) {
                        continue;
                    }

                    if (typeof object.getLevel !== 'function') {
                        BaseCounter._patchClientLib();

                    }

                    var level = object.getLevel();
                    levelCount[level] = (levelCount[level] || 0) + 1;

                    count++;
                }
            }

            var output = [];
            for (var i = 0; i < levelCount.length; i++) {
                var lvl = levelCount[i];
                if (lvl !== undefined) {
                    output.push(lvl + ' x ' + i);
                }
            }

            console.log('[' + x + ':' + y + '] Found ' + count + ' bases - ' + output.join(', '));
            if (paste === undefined || paste === true){
                BaseCounter.pasteOutput(x, y, count, output.join(', '));
            }
            return {total: count, levels: levelCount};
        },

        count: function(paste) {
            if (BaseCounter.selectedBase === null || BaseCounter.selectedBase === undefined) {
                return;
            }

            return BaseCounter.countBases(BaseCounter.selectedBase.get_RawX(), BaseCounter.selectedBase.get_RawY(), paste);
        },

        startup: function() {
            var world = ClientLib.Data.MainData.GetInstance().get_Server().get_WorldId();
            if (world === 261 || world === 286) {
                BaseCounter.registerButton();
            } else {
                console.log('AF: Skipping module [BaseCounter] wrong world:' + world);
            }

        },

        destroy: function() {
            if ( webfrontend.gui.region.RegionCityMenu.prototype.__baseCounterButton_showMenu ){
                webfrontend.gui.region.RegionCityMenu.prototype.showMenu = webfrontend.gui.region.RegionCityMenu.prototype.__baseCounterButton_showMenu;
                webfrontend.gui.region.RegionCityMenu.prototype.__baseCounterButton_initialized = false;
                webfrontend.gui.region.RegionCityMenu.prototype.__baseCounterButton_showMenu = undefined;
            }
        },

        registerButton: function() {
            if (!webfrontend.gui.region.RegionCityMenu.prototype.__baseCounterButton_showMenu) {
                webfrontend.gui.region.RegionCityMenu.prototype.__baseCounterButton_showMenu = webfrontend.gui.region.RegionCityMenu.prototype.showMenu;

                webfrontend.gui.region.RegionCityMenu.prototype.showMenu = function(selectedVisObject) {
                    BaseCounter.selectedBase = selectedVisObject;
                    if (this.__baseCounterButton_initialized !== true) {
                        this.__baseCounterButton_initialized = true;
                        // this.__baseComposite = new qx.ui.container.Composite(new qx.ui.layout.VBox(0)).set({
                        //     padding: 2
                        // });

                        this.__baseCountButton = new qx.ui.form.Button('Paste BaseCount');
                        this.__baseCountButton.addListener('execute', function(){
                            BaseCounter.count();
                        });
                        console.log('button made');
                        // this.__baseComposite.add(this.__baseCountButton);

                    }


                    if (BaseCounter.lastBase !== BaseCounter.selectedBase){
                        var count = BaseCounter.count(false);
                        console.log(count);
                        this.__baseCountButton.setLabel('Bases: ' + count.total);
                        BaseCounter.lastBase = BaseCounter.selectedBase;
                    }
                    // console.log(children);
                    this.__baseCounterButton_showMenu(selectedVisObject);
                    switch (selectedVisObject.get_VisObjectType()) {
                        case ClientLib.Vis.VisObject.EObjectType.RegionNPCCamp:
                        case ClientLib.Vis.VisObject.EObjectType.RegionNPCBase:
                        case ClientLib.Vis.VisObject.EObjectType.RegionPointOfInterest:
                        case ClientLib.Vis.VisObject.EObjectType.RegionRuin:
                        case ClientLib.Vis.VisObject.EObjectType.RegionHubControl:
                        case ClientLib.Vis.VisObject.EObjectType.RegionHubServer:
                        case ClientLib.Vis.VisObject.EObjectType.RegionCityType:
                            this.add(this.__baseCountButton);
                            break;
                        default:
                            console.log(selectedVisObject.get_VisObjectType());
                    }
                };
            }

        },

        _patchClientLib: function() {
            var proto = ClientLib.Data.WorldSector.WorldObjectNPCBase.prototype;
            var re = /100\){0,1};this\.(.{6})=Math.floor.*d\+=f;this\.(.{6})=\(/;
            var x = AF.util._g(proto.$ctor, re, 'ClientLib.Data.WorldSector.WorldObjectNPCBase', 2);
            if (x !== null && x[1].length === 6) {
                proto.getLevel = function() {
                    return this[x[1]];
                };
            } else {
                console.error('Error - ClientLib.Data.WorldSector.WorldObjectNPCBase.Level undefined');
            }
        }

    };

    AF.util.waitForLoad(function() {
        var world = ClientLib.Data.MainData.GetInstance().get_Server().get_WorldId();
        if (world === 261) {
            console.log('AF: Starting module [BaseCounter]');
            BaseCounter.startup();
        } else {
            console.log('AF: Skipping module [BaseCounter] wrong world:' + world);
        }
    });
};


var AF_MODULES = window.AF_MODULES || [];
AF_MODULES.push(baseCounter);/* End: client/modules/basescount.js */

function innerHTML(functions) {
    var output = '';
    for (var i = 0; i < functions.length; i++) {
        var func = functions[i];
        output += '(' + func.toString() + ')();\n';
    }
    return output;
}

if (window.location.pathname !== ('/login/auth')) {
    var script = document.createElement('script');
    script.innerHTML = innerHTML(AF_MODULES);
    script.type = 'text/javascript';
    document.getElementsByTagName('head')[0].appendChild(script);
}
