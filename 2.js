
function waitForGlobalObject(objectName, objectNextName) {
        return new Promise((resolve) => {
            function check() {
                if ((window[objectName] !== undefined)
                        && ((objectNextName === undefined) || window[objectName][objectNextName] !== undefined)) {
                    resolve();
                } else {
                    setTimeout(check, 200);
                }
            }

            check();
        });
    }

    function waitForModule(moduleName) {
        return new Promise((resolve) => {
            function check() {
                try {
                    resolve(require(moduleName));
                } catch (e) {
                    setTimeout(check, 200);
                }
            }

            check();
        });
    }

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script= document.createElement('script');
            script.type= 'text/javascript';
            script.onload = () => {
                resolve();
            };
            script.onerror = () => {
                console.log("Failed to load script", src);
                reject();
            };
            script.src = src;
            document.head.appendChild(script);
        });
    }

    function loadStyle(src) {
        return new Promise((resolve, reject) => {
            const link= document.createElement('link');
            link.rel = 'stylesheet';
            link.type= 'text/css';
            link.onload = () => {
                resolve();
            };
            link.onerror = () => {
                console.log("Failed to load CSS", src);
                reject();
            };
            link.href = src;
            document.head.appendChild(link);
        });
    }

    class DemoApp {
        async init() {
            await waitForGlobalObject("p2pml", "core");

            this.isP2PSupported = p2pml.core.HybridLoader.isSupported();
            if (!this.isP2PSupported) {
                document.querySelector("#error-webrtc-data-channels").classList.remove("hide");
            }

            if (location.protocol == "https:") {
                document.querySelector("#https-only").classList.remove("hide");
            }

            this.liveSyncDurationCount = 7;

            this.initForm();

            var videoUrlForm = document.getElementById("videoUrlForm");
            this.videoUrl = videoUrlForm.url.value.trim();
            this.playerType = videoUrlForm.type.value;
            this.videoContainer = document.getElementById("video_container");




            this.restartDemo();
        }

        initForm() {
            var form = document.getElementById("videoUrlForm");
            var params = new URLSearchParams(document.location.search);

            var value = params.get("url");
            if (value) {
                form.url.value = value;
            }

            value = params.get("type");
            if (value) {
                form.type.value = value;
            }

            value = params.get("swarm");
            if (value) {
                this.swarmId = value;
            }

            value = params.get("trackers");
            if (value) {
                this.trackers = value.split(",");
            }
        }

        async restartDemo() {
            this.downloadStats = [];
            this.downloadTotals = { http: 0, p2p: 0 };
            this.uploadStats = [];
            this.uploadTotal = 0;

            while (this.videoContainer.hasChildNodes()) {
                this.videoContainer.removeChild(this.videoContainer.lastChild);
            }

            const config = {
                segments: {
                    swarmId: this.swarmId
                },
                loader: {
                }
            };

   

            switch (this.playerType) {
                case "hlsjs":
                case "clappr":
                case "flowplayer":
                case "mediaelement":
                case "videojs-contrib-hlsjs":
                case "videojs-hlsjs-plugin":
                case "dplayer":
                case "jwplayer":
                case "plyr":
                    await loadScript("https://cdn.jsdelivr.net/npm/hls.js@latest");

                    if (!Hls.isSupported()) {
                        document.querySelector("#error-hls-js").classList.remove("hide");
                    }

                    await loadScript(URL_P2P_MEDIA_LOADER_HLSJS);
                    this.engine = this.isP2PSupported ? new p2pml.hlsjs.Engine(config) : undefined;
                    break;

                case "shakaplayer":
                case "dplayer-shaka":
                case "clappr-shaka":
                case "plyr-shaka":
                    await Promise.all([
                        loadScript("https://github.com/videojs/mux.js/releases/download/v5.1.2/mux.js"),
                        loadScript("https://cdnjs.cloudflare.com/ajax/libs/shaka-player/2.5.1/shaka-player.compiled.js")
                    ]);

                    shaka.polyfill.installAll();
                    if (!shaka.Player.isBrowserSupported()) {
                        document.querySelector("#error-shakaplayer").classList.remove("hide");
                    }

                    await loadScript(URL_P2P_MEDIA_LOADER_SHAKA);
                    this.engine = this.isP2PSupported ? new p2pml.shaka.Engine(config) : undefined;
                    break;

                default:
                    console.error('Unexpected player type: ', this.playerType);
                    return;
            }

            switch (this.playerType) {
                case "hlsjs":
                    this.initHlsJsPlayer();
                    break;

                case "clappr":
                    this.initClapprPlayer();
                    break;

                case "flowplayer":
                    this.initFlowplayerPlayer();
                    break;

                case "mediaelement":
                    this.initMediaElementPlayer();
                    break;

                case "videojs-contrib-hlsjs":
                    this.initVideoJsContribHlsJsPlayer();
                    break;

                case "videojs-hlsjs-plugin":
                    this.initVideoJsHlsJsPlugin();
                    break;

                case "jwplayer":
                    this.initJwPlayer();
                    break;

                case "dplayer":
                    this.initDPlayerHlsJs();
                    break;

                case "plyr":
                    this.initPlyrPlayerHlsJs();
                    break;

                case "shakaplayer":
                    this.initShakaPlayer();
                    break;

                case "clappr-shaka":
                    this.initClapprPlayer(true);
                    break;

                case "dplayer-shaka":
                    this.initDPlayerShaka();
                    break;

                case "plyr-shaka":
                    this.initPlyrPlayerShaka();
                    break;
            }

        }

        async initHlsJsPlayer() {
            if (!Hls.isSupported()) {
                return;
            }
            var video = document.createElement("video");
            video.id = "video";
            video.volume = 0;
            video.setAttribute("playsinline", "");
            video.setAttribute("muted", "");
            video.setAttribute("autoplay", "");
            video.setAttribute("controls", "");
            this.videoContainer.appendChild(video);

            var level = document.createElement("select");
            level.id = "level";
            level.classList.add("form-control");
            this.videoContainer.appendChild(level);

            var hls = new Hls({
                liveSyncDurationCount: this.liveSyncDurationCount,
                loader: this.isP2PSupported ? this.engine.createLoaderClass() : Hls.DefaultConfig.loader
            });

            if (this.isP2PSupported) {
                p2pml.hlsjs.initHlsJsPlayer(hls);
            }

            hls.loadSource(this.videoUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                this.hlsLevelSwitcher.init(hls, level);
            });
        }

        async initClapprPlayer(isShaka) {
            const scriptsPromise = (async () => {
                await loadScript("https://cdn.jsdelivr.net/npm/clappr@latest");
                await loadScript("https://cdn.jsdelivr.net/gh/clappr/clappr-level-selector-plugin@latest/dist/level-selector.min.js");
            })();

            var outer = document.createElement("div");
            outer.className = "embed-responsive embed-responsive-16by9";
            var video = document.createElement("div");
            video.id = "video";
            video.className = "embed-responsive-item";
            outer.appendChild(video);
            this.videoContainer.appendChild(outer);

            var setup = {
                parentId: "#video",
                plugins: [],
                source: this.videoUrl,
                width: "100%",
                height: "100%",
                muted: true,
                mute: true,
                autoPlay: true,
                playback: {
                    playInline: true
                }
            };

            if (isShaka) {
                await scriptsPromise;
                await loadScript("https://cdn.jsdelivr.net/gh/clappr/dash-shaka-playback@latest/dist/dash-shaka-playback.external.js");
                setup.plugins.push(DashShakaPlayback);
                setup.shakaOnBeforeLoad = (shakaPlayerInstance) => {
                    if (this.isP2PSupported) {
                        this.engine.initShakaPlayer(shakaPlayerInstance);
                    }
                };
            } else {
                setup.playback.hlsjsConfig = {
                    liveSyncDurationCount: this.liveSyncDurationCount,
                    loader: this.isP2PSupported ? this.engine.createLoaderClass() : Hls.DefaultConfig.loader
                };
            }

            await scriptsPromise;

            setup.plugins.push(LevelSelector);

            var player = new Clappr.Player(setup);

            if (!isShaka && this.isP2PSupported) {
                p2pml.hlsjs.initClapprPlayer(player);
            }
        }

        async initMediaElementPlayer() {
            const scriptPromise = loadScript("https://cdnjs.cloudflare.com/ajax/libs/mediaelement/4.2.9/mediaelement-and-player.min.js");
            loadStyle("https://cdnjs.cloudflare.com/ajax/libs/mediaelement/4.2.9/mediaelementplayer.min.css");

            var video = document.createElement("video");
            video.id = "video";
            video.volume = 0;
            video.setAttribute("playsinline", "");
            video.setAttribute("muted", "");
            video.setAttribute("autoplay", "");
            this.videoContainer.appendChild(video);

            await scriptPromise;

            // allow only one supported renderer
            mejs.Renderers.order = ["native_hls"];

            var player = new MediaElementPlayer("video", {
                stretching: "responsive",
                startVolume: 0,
                hls: {
                    liveSyncDurationCount: this.liveSyncDurationCount,
                    loader: this.isP2PSupported ? this.engine.createLoaderClass() : Hls.DefaultConfig.loader
                },
                success: (mediaElement) => {
                    if (this.isP2PSupported) {
                        p2pml.hlsjs.initMediaElementJsPlayer(mediaElement)
                    }
                }
            });

            player.setSrc(this.videoUrl);
            //player.options.forceLive = true;

            player.load();
            player.play();
        }

        async initFlowplayerPlayer() {
            const scriptPromise = loadScript("https://releases.flowplayer.org/7.2.7/flowplayer.min.js");
            loadStyle("https://releases.flowplayer.org/7.2.7/skin/skin.css");

            var video = document.createElement("div");
            video.id = "video";
            video.className = "fp-slim";
            this.videoContainer.appendChild(video);

            await scriptPromise;

            var player = flowplayer("#video", {
                autoplay: true,
                muted: true,
                live: true,
                clip: {
                    sources: [{
                        type: "application/x-mpegurl",
                        src: this.videoUrl
                    }]
                },
                hlsjs: {
                    liveSyncDurationCount: this.liveSyncDurationCount,
                    loader: this.isP2PSupported ? this.engine.createLoaderClass() : Hls.DefaultConfig.loader,
                    safari: true
                }
            });

            if (this.isP2PSupported) {
                p2pml.hlsjs.initFlowplayerHlsJsPlayer(player);
            }
        }

        async initVideoJsContribHlsJsPlayer() {
            const scriptPromise = (async () => {
                await loadScript("https://vjs.zencdn.net/7.6.0/video.js");
                await loadScript("https://cdn.jsdelivr.net/npm/videojs-contrib-hls.js@latest");
            })();

            loadStyle("https://vjs.zencdn.net/7.6.0/video-js.css");

            var outer = document.createElement("div");
            outer.className = "embed-responsive embed-responsive-16by9";
            var video = document.createElement("video");
            video.id = "video";
            video.preload = "none";
            video.className = "embed-responsive-item video-js vjs-default-skin";
            video.volume = 0;
            video.setAttribute("playsinline", "");
            video.setAttribute("muted", "");
            video.setAttribute("autoplay", "");
            video.setAttribute("controls", "");
            outer.appendChild(video);
            this.videoContainer.appendChild(outer);

            await scriptPromise;

            var player = videojs("video", {
                html5: {
                    hlsjsConfig: {
                        liveSyncDurationCount: this.liveSyncDurationCount,
                        loader: this.isP2PSupported ? this.engine.createLoaderClass() : Hls.DefaultConfig.loader
                    }
                }
            });

            if (this.isP2PSupported) {
                p2pml.hlsjs.initVideoJsContribHlsJsPlayer(player);
            }

            player.src({
                type: "application/x-mpegURL",
                src: this.videoUrl
            });

            player.ready(() => {
                player.volume(0);
                player.play();
            });
        }

        async initVideoJsHlsJsPlugin() {
            const scriptPromise = await (async () => {
                await loadScript("https://vjs.zencdn.net/7.6.0/video.js");
                await Promise.all([
                    loadScript("https://cdn.streamroot.io/videojs-hlsjs-plugin/1/stable/videojs-hlsjs-plugin.js"),
                    loadScript("https://cdn.jsdelivr.net/npm/videojs-contrib-quality-levels@latest/dist/videojs-contrib-quality-levels.min.js"),
                    loadScript("https://cdn.jsdelivr.net/npm/videojs-http-source-selector@latest/dist/videojs-http-source-selector.js")
                ]);
            })();

            loadStyle("https://vjs.zencdn.net/7.6.0/video-js.css");

            var outer = document.createElement("div");
            outer.className = "embed-responsive embed-responsive-16by9";
            var video = document.createElement("video");
            video.id = "video";
            video.className = "embed-responsive-item video-js vjs-default-skin";
            video.setAttribute("muted", "");
            video.setAttribute("autoplay", "");
            video.setAttribute("controls", "");
            outer.appendChild(video);
            this.videoContainer.appendChild(outer);

            await scriptPromise;

            if (this.isP2PSupported) {
                p2pml.hlsjs.initVideoJsHlsJsPlugin();
            }

            var player = videojs("video", {
                html5: {
                    hlsjsConfig: {
                        liveSyncDurationCount: this.liveSyncDurationCount,
                        loader: this.isP2PSupported ? this.engine.createLoaderClass() : Hls.DefaultConfig.loader
                    }
                }
            });

            player.httpSourceSelector();

            player.src({
                src: this.videoUrl,
                type: "application/x-mpegURL"
            });
        }

        async initJwPlayer() {
            const scriptPromise = await Promise.all([
                loadScript("https://content.jwplatform.com/libraries/aG3IMhIy.js"),
                loadScript("https://cdn.jsdelivr.net/npm/@hola.org/jwplayer-hlsjs@latest/dist/jwplayer.hlsjs.min.js")
            ]);

            var video = document.createElement("div");
            video.id = "video";
            video.volume = 0;
            video.setAttribute("playsinline", "");
            video.setAttribute("muted", "");
            video.setAttribute("autoplay", "");
            this.videoContainer.appendChild(video);

            await scriptPromise;

            var player = jwplayer("video");
            player.setup({ file: this.videoUrl, mute: true });

            jwplayer_hls_provider.attach();

            if (this.isP2PSupported) {
                p2pml.hlsjs.initJwPlayer(player, {
                    liveSyncDurationCount: this.liveSyncDurationCount,
                    loader: this.engine.createLoaderClass()
                });
            }
        }

        async initDPlayerHlsJs() {
            if (!Hls.isSupported()) {
                return;
            }

            const scriptPromise = loadScript("https://cdn.jsdelivr.net/npm/dplayer@latest");
            loadStyle("https://cdn.jsdelivr.net/npm/p2p-dplayer@latest/dist/DPlayer.min.css");

            var outer = document.createElement("div");
            outer.id = "dplayer";
            this.videoContainer.appendChild(outer);

            await scriptPromise;

            window.dp = new DPlayer({
                container: document.getElementById("dplayer"),
                video: {
                    url: this.videoUrl,
                    type: "customHls",
                    customType: {
                        "customHls": (video, player) => {
                            const hls = new Hls({
                                liveSyncDurationCount: 7, // To have at least 7 segments in queue
                                loader: this.engine.createLoaderClass()
                            });

                            p2pml.hlsjs.initHlsJsPlayer(hls);

                            hls.loadSource(video.src);
                            hls.attachMedia(video);
                        }
                    }
                }
            });
        }

        async initDPlayerShaka() {
            if (!shaka.Player.isBrowserSupported()) {
                return;
            }

            const scriptPromise = loadScript("https://cdn.jsdelivr.net/npm/dplayer@latest");
            loadStyle("https://cdn.jsdelivr.net/npm/p2p-dplayer@latest/dist/DPlayer.min.css");

            var outer = document.createElement("div");
            outer.id = "dplayer";
            this.videoContainer.appendChild(outer);

            await scriptPromise;

            window.dp = new DPlayer({
                container: document.getElementById("dplayer"),
                video: {
                    url: this.videoUrl,
                    type: "customHlsOrDash",
                    customType: {
                        "customHlsOrDash": (video, player) => {
                            const src = video.src; // Shaka Player changes video.src to blob URL
                            const shakaPlayer = new shaka.Player(video);

                            const onError = function(error) { console.error("Error code", error.code, "object", error); }
                            shakaPlayer.addEventListener("error", function(event) { onError(event.detail); });

                            this.engine.initShakaPlayer(shakaPlayer);

                            shakaPlayer.load(src).catch(onError);
                        }
                    }
                }
            });
        }

        initShakaPlayer() {
            if (!shaka.Player.isBrowserSupported()) {
                return;
            }

            var video = document.createElement("video");
            video.id = "video";
            video.volume = 0;
            video.setAttribute("playsinline", "");
            video.setAttribute("muted", "");
            video.setAttribute("autoplay", "");
            video.setAttribute("controls", "");
            this.videoContainer.appendChild(video);

            var level = document.createElement("select");
            level.id = "level";
            level.classList.add("form-control");
            this.videoContainer.appendChild(level);

            var player = new shaka.Player(video);
            if (this.isP2PSupported) {
                this.engine.initShakaPlayer(player);
            }
            this.shakaLevelSwitcher.init(player, level);
            player.load(this.videoUrl);
        }

        async initPlyrPlayerHlsJs() {
            if (!Hls.isSupported()) {
                return;
            }

            const scriptPromise = loadScript("https://cdn.plyr.io/3.5.6/plyr.js");
            loadStyle("https://cdn.plyr.io/3.5.6/plyr.css");

            var video = document.createElement("video");
            video.id = "video";
            video.setAttribute("muted", "");
            video.setAttribute("autoplay", "");
            video.setAttribute("controls", "");
            this.videoContainer.appendChild(video);

            var level = document.createElement("select");
            level.id = "level";
            level.classList.add("form-control");
            this.videoContainer.appendChild(level);

            await scriptPromise;

            var player = new Plyr(video, {
                captions: {
                    active: true,
                    update: true,
                }
            });

            var hls = new Hls({
                liveSyncDurationCount: this.liveSyncDurationCount,
                loader: this.isP2PSupported ? this.engine.createLoaderClass() : Hls.DefaultConfig.loader
            });

            if (this.isP2PSupported) {
                p2pml.hlsjs.initHlsJsPlayer(hls);
            }

            hls.loadSource(this.videoUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                this.hlsLevelSwitcher.init(hls, level);
            });
        }

        async initPlyrPlayerShaka() {
            if (!shaka.Player.isBrowserSupported()) {
                return;
            }

            const scriptPromise = loadScript("https://cdn.plyr.io/3.5.6/plyr.js");
            loadStyle("https://cdn.plyr.io/3.5.6/plyr.css");

            var video = document.createElement("video");
            video.id = "video";
            video.volume = 0;
            video.setAttribute("muted", "");
            video.setAttribute("autoplay", "");
            video.setAttribute("controls", "");
            this.videoContainer.appendChild(video);

            var level = document.createElement("select");
            level.id = "level";
            level.classList.add("form-control");
            this.videoContainer.appendChild(level);

            await scriptPromise;

            var player = new Plyr(video);

            var shakaPlayer = new shaka.Player(video);
            if (this.isP2PSupported) {
                this.engine.initShakaPlayer(shakaPlayer);
            }
            this.shakaLevelSwitcher.init(shakaPlayer, level);
            shakaPlayer.load(this.videoUrl);
        }
 
    }

    const demo = new DemoApp();
    demo.init();
