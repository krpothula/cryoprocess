import { useEffect, useRef, useState } from "react";
import { BiLoader } from "react-icons/bi";
import {
  FiAlertCircle,
  FiRefreshCw,
  FiEye,
  FiEyeOff,
  FiMaximize2,
  FiRotateCcw,
} from "react-icons/fi";
// Import Molstar CSS
import "molstar/build/viewer/molstar.css";

const API_BASE_URL = process.env.REACT_APP_API_HOST || "";

/**
 * Enhanced Molstar viewer for Mask visualization with overlay support.
 */
const MolstarMaskViewer = ({
  jobId,
  maskApiEndpoint = "/maskcreate/mrc/",
  sourceMapPath = null,
  initialOpacity = 0.85,
  initialThreshold = 0.5,
}) => {
  const containerRef = useRef(null);
  const pluginRef = useRef(null);

  // Volume refs
  const maskVolumeRef = useRef(null);
  const maskDataRef = useRef(null);
  const mapVolumeRef = useRef(null);
  const mapDataRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [initialized, setInitialized] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Mask controls
  const [maskOpacity, setMaskOpacity] = useState(initialOpacity);
  const [isoThreshold, setIsoThreshold] = useState(initialThreshold);
  const [showMask, setShowMask] = useState(true);

  // Map overlay controls
  const [showMap, setShowMap] = useState(true);
  const [mapOpacity, setMapOpacity] = useState(0.5);
  const [mapThreshold, setMapThreshold] = useState(1.5);

  const [isFullscreen, setIsFullscreen] = useState(false);

  // Build URL (auth via HttpOnly cookie)
  const getMrcUrl = (endpoint, params = {}) => {
    const sep = endpoint.includes("?") ? "&" : "?";
    let path = `${endpoint}${sep}`;
    const paramStr = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
    return `${API_BASE_URL}${path}${paramStr}`;
  };

  // Reset camera
  const resetCamera = async () => {
    if (pluginRef.current) {
      const { PluginCommands } = await import("molstar/lib/mol-plugin/commands");
      await PluginCommands.Camera.Reset(pluginRef.current, {});
    }
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    const container = containerRef.current?.parentElement?.parentElement;
    if (!container) return;

    if (!isFullscreen) {
      container.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  // Track mask representation ref for updates
  const maskReprRef = useRef(null);

  // Effect: Rebuild mask when controls change
  useEffect(() => {
    if (!initialized) return;

    const plugin = pluginRef.current;
    const maskVolume = maskVolumeRef.current;
    const maskData = maskDataRef.current;

    if (!plugin || !maskVolume || !maskData) return;

    const currentShowMask = showMask;
    const currentMaskOpacity = maskOpacity;
    const currentIsoThreshold = isoThreshold;

    const rebuildMask = async () => {
      try {
        const { StateTransforms } = await import("molstar/lib/mol-plugin-state/transforms");
        const { createVolumeRepresentationParams } = await import(
          "molstar/lib/mol-plugin-state/helpers/volume-representation-params"
        );
        const { StateSelection } = await import("molstar/lib/mol-state");

        const state = plugin.state.data;
        const children = state.select(StateSelection.Generators.ofTransformer(
          StateTransforms.Representation.VolumeRepresentation3D
        ));

        const toDelete = [];
        for (const child of children) {
          let current = child.transform?.parent;
          let depth = 0;
          while (current && depth < 5) {
            if (current === maskVolume || String(current) === String(maskVolume)) {
              toDelete.push(child.transform.ref);
              break;
            }
            const parentCell = state.cells.get(current);
            current = parentCell?.transform?.parent;
            depth++;
          }
        }

        if (maskReprRef.current && !toDelete.includes(maskReprRef.current)) {
          toDelete.push(maskReprRef.current);
        }

        if (toDelete.length > 0) {
          const del = plugin.build();
          toDelete.forEach(ref => del.delete(ref));
          await del.commit();
          maskReprRef.current = null;
          await new Promise(r => setTimeout(r, 30));
        }

        if (!currentShowMask) return;

        const params = createVolumeRepresentationParams(plugin, maskData, {
          type: "isosurface",
          typeParams: {
            isoValue: { kind: "absolute", absoluteValue: currentIsoThreshold },
            alpha: currentMaskOpacity,
            visuals: ["solid"],
            tryUseGpu: true,
          },
          color: "uniform",
          colorParams: { value: 0x9ca3af },
        });

        const builder = plugin.build();
        const reprBuilder = builder.to({ ref: maskVolume }).apply(
          StateTransforms.Representation.VolumeRepresentation3D,
          params
        );

        await builder.commit();
        maskReprRef.current = reprBuilder.ref;
      } catch (e) {
        console.error("[MaskViewer] rebuildMask error:", e);
      }
    };

    rebuildMask();
  }, [initialized, showMask, maskOpacity, isoThreshold]);

  // Track map representation ref for updates
  const mapReprRef = useRef(null);

  // Effect: Rebuild map when controls change
  useEffect(() => {
    if (!mapLoaded) return;

    const plugin = pluginRef.current;
    const mapVolume = mapVolumeRef.current;
    const mapData = mapDataRef.current;

    if (!plugin || !mapVolume || !mapData) return;

    const currentShowMap = showMap;
    const currentMapOpacity = mapOpacity;
    const currentMapThreshold = mapThreshold;

    const rebuildMap = async () => {
      try {
        const { StateTransforms } = await import("molstar/lib/mol-plugin-state/transforms");
        const { createVolumeRepresentationParams } = await import(
          "molstar/lib/mol-plugin-state/helpers/volume-representation-params"
        );
        const { StateSelection } = await import("molstar/lib/mol-state");

        const state = plugin.state.data;

        const children = state.select(StateSelection.Generators.ofTransformer(
          StateTransforms.Representation.VolumeRepresentation3D
        ));

        const toDelete = [];
        for (const child of children) {
          let current = child.transform?.parent;
          let depth = 0;
          while (current && depth < 5) {
            if (current === mapVolume || String(current) === String(mapVolume)) {
              toDelete.push(child.transform.ref);
              break;
            }
            const parentCell = state.cells.get(current);
            current = parentCell?.transform?.parent;
            depth++;
          }
        }

        if (mapReprRef.current && !toDelete.includes(mapReprRef.current)) {
          toDelete.push(mapReprRef.current);
        }

        if (toDelete.length > 0) {
          const del = plugin.build();
          toDelete.forEach(ref => del.delete(ref));
          await del.commit();
          mapReprRef.current = null;
          await new Promise(r => setTimeout(r, 30));
        }

        if (!currentShowMap) return;

        const params = createVolumeRepresentationParams(plugin, mapData, {
          type: "isosurface",
          typeParams: {
            isoValue: { kind: "relative", relativeValue: currentMapThreshold },
            alpha: currentMapOpacity,
            visuals: ["solid"],
            tryUseGpu: true,
          },
          color: "uniform",
          colorParams: { value: 0x3b82f6 },
        });

        const builder = plugin.build();
        const reprBuilder = builder.to({ ref: mapVolume }).apply(
          StateTransforms.Representation.VolumeRepresentation3D,
          params
        );
        await builder.commit();

        mapReprRef.current = reprBuilder.ref;
      } catch (e) {
        console.error("[MaskViewer] rebuildMap error:", e);
      }
    };

    rebuildMap();
  }, [mapLoaded, showMap, mapOpacity, mapThreshold]);

  // Load source map when overlay is enabled
  useEffect(() => {
    if (!showMap || !sourceMapPath || !pluginRef.current || !initialized || mapLoaded) return;

    const loadSourceMap = async () => {
      try {
        const plugin = pluginRef.current;
        const { StateTransforms } = await import("molstar/lib/mol-plugin-state/transforms");
        const { createVolumeRepresentationParams } = await import(
          "molstar/lib/mol-plugin-state/helpers/volume-representation-params"
        );

        const mapUrl = getMrcUrl("/maskcreate/mrc/", { jobId, filePath: sourceMapPath });

        const downloadedData = await plugin.builders.data.download(
          { url: mapUrl, isBinary: true, label: "source_map" },
          { state: { isGhost: true } }
        );

        await plugin.dataFormats.get("ccp4").parse(plugin, downloadedData);

        const state = plugin.state.data;
        let foundVolumeRef = null;
        let foundVolumeData = null;
        const maskRef = maskVolumeRef.current;

        for (const [ref, cell] of state.cells) {
          const isVolume = cell?.obj?.type?.name === 'Volume' || cell?.obj?.label === 'Volume';
          if (isVolume && ref !== maskRef) {
            foundVolumeRef = ref;
            foundVolumeData = cell.obj?.data;
          }
        }

        if (!foundVolumeRef || !foundVolumeData) return;

        mapVolumeRef.current = foundVolumeRef;
        mapDataRef.current = foundVolumeData;

        const builder = plugin.build();
        builder.to({ ref: foundVolumeRef }).apply(
          StateTransforms.Representation.VolumeRepresentation3D,
          createVolumeRepresentationParams(plugin, foundVolumeData, {
            type: "isosurface",
            typeParams: {
              isoValue: { kind: "relative", relativeValue: mapThreshold },
              alpha: mapOpacity,
            },
            color: "uniform",
            colorParams: { value: 0x3b82f6 },
          })
        );
        await builder.commit();
        setMapLoaded(true);
      } catch (e) {
        console.error("[MaskViewer] Error loading map:", e);
      }
    };

    loadSourceMap();
  }, [showMap, sourceMapPath, initialized, mapLoaded]);

  // Initialize and load mask volume
  useEffect(() => {
    if (!containerRef.current || !jobId) return;

    let disposed = false;

    const initAndLoad = async () => {
      try {
        setLoading(true);
        setError(null);
        setInitialized(false);
        setMapLoaded(false);

        if (pluginRef.current) {
          try { pluginRef.current.dispose(); } catch (e) {}
          pluginRef.current = null;
        }

        maskVolumeRef.current = null;
        maskDataRef.current = null;
        mapVolumeRef.current = null;
        mapDataRef.current = null;

        const { createPluginUI } = await import("molstar/lib/mol-plugin-ui");
        const { renderReact18 } = await import("molstar/lib/mol-plugin-ui/react18");
        const { DefaultPluginUISpec } = await import("molstar/lib/mol-plugin-ui/spec");
        const { PluginCommands } = await import("molstar/lib/mol-plugin/commands");
        const { StateTransforms } = await import("molstar/lib/mol-plugin-state/transforms");
        const { createVolumeRepresentationParams } = await import(
          "molstar/lib/mol-plugin-state/helpers/volume-representation-params"
        );

        if (disposed) return;

        containerRef.current.innerHTML = "";

        const plugin = await createPluginUI({
          target: containerRef.current,
          render: renderReact18,
          spec: {
            ...DefaultPluginUISpec(),
            layout: {
              initial: {
                isExpanded: false,
                showControls: false,
                controlsDisplay: "reactive",
                regionState: {
                  left: "hidden",
                  right: "hidden",
                  top: "hidden",
                  bottom: "hidden",
                },
              },
            },
            components: { remoteState: "none" },
          },
        });

        if (disposed) {
          plugin.dispose();
          return;
        }

        pluginRef.current = plugin;

        const maskUrl = getMrcUrl(maskApiEndpoint, { jobId });

        const maskData = await plugin.builders.data.download(
          { url: maskUrl, isBinary: true, label: "mask" },
          { state: { isGhost: true } }
        );

        if (disposed) return;

        await plugin.dataFormats.get("ccp4").parse(plugin, maskData);

        const state = plugin.state.data;
        let foundMaskRef = null;
        let foundMaskData = null;

        for (const [ref, cell] of state.cells) {
          if (cell?.obj?.type?.name === 'Volume' || cell?.obj?.label === 'Volume') {
            foundMaskRef = ref;
            foundMaskData = cell.obj.data;
            break;
          }
        }

        if (!foundMaskRef || !foundMaskData) {
          throw new Error("Failed to load mask volume");
        }

        maskVolumeRef.current = foundMaskRef;
        maskDataRef.current = foundMaskData;

        const maskRepr = plugin.build();
        maskRepr.to({ ref: foundMaskRef }).apply(
          StateTransforms.Representation.VolumeRepresentation3D,
          createVolumeRepresentationParams(plugin, foundMaskData, {
            type: "isosurface",
            typeParams: {
              isoValue: { kind: "absolute", absoluteValue: initialThreshold },
              alpha: initialOpacity,
              visuals: ["solid"],
            },
            color: "uniform",
            colorParams: { value: 0x9ca3af },
          })
        );

        await maskRepr.commit();
        await PluginCommands.Camera.Reset(plugin, {});

        if (!disposed) {
          setLoading(false);
          setInitialized(true);
        }
      } catch (err) {
        console.error("[MaskViewer] Init error:", err);
        if (!disposed) {
          setError(`Failed to load: ${err.message}`);
          setLoading(false);
        }
      }
    };

    initAndLoad();

    return () => {
      disposed = true;
      if (pluginRef.current) {
        pluginRef.current.dispose();
        pluginRef.current = null;
      }
    };
  }, [jobId, maskApiEndpoint]);

  const sliderBg = (value, min, max, color) => {
    const pct = ((value - min) / (max - min)) * 100;
    return `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, var(--color-border) ${pct}%, var(--color-border) 100%)`;
  };

  return (
    <div className="relative rounded-lg overflow-hidden border border-[var(--color-border)]">
      {/* Control Panel - Light theme matching MolstarViewer */}
      {!loading && !error && (
        <div style={{ backgroundColor: "var(--color-bg)" }} className="border-b border-[var(--color-border)]">
          {/* Row 1: Toggle buttons side by side + action buttons */}
          <div className="px-3 py-1.5 flex items-center gap-2">
            <button
              onClick={() => setShowMask(!showMask)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                showMask
                  ? "bg-[var(--color-bg-active)] text-[var(--color-text)]"
                  : "bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]"
              }`}
              style={{ fontSize: "11px", fontWeight: 500 }}
            >
              {showMask ? <FiEye size={12} /> : <FiEyeOff size={12} />}
              <span className="w-2 h-2 rounded-full bg-[var(--color-text-muted)]"></span>
              Mask
            </button>

            {sourceMapPath && (
              <button
                onClick={() => setShowMap(!showMap)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                  showMap
                    ? "bg-[var(--color-primary-light)] text-[var(--color-primary)]"
                    : "bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]"
                }`}
                style={{ fontSize: "11px", fontWeight: 500 }}
              >
                {showMap ? <FiEye size={12} /> : <FiEyeOff size={12} />}
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                Map
              </button>
            )}

            <div className="flex items-center gap-1 ml-auto">
              <button
                onClick={resetCamera}
                className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-active)] transition-all"
                title="Reset camera"
              >
                <FiRotateCcw size={13} />
              </button>
              <button
                onClick={toggleFullscreen}
                className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-active)] transition-all"
                title="Fullscreen"
              >
                <FiMaximize2 size={13} />
              </button>
            </div>
          </div>

          {/* Row 2: Mask isosurface + opacity (full width) */}
          {showMask && (
            <div className="px-3 py-1 flex items-center gap-2 border-t border-[var(--color-border)]">
              <span className="flex items-center gap-1.5 whitespace-nowrap" style={{ fontSize: "10px", fontWeight: 500, color: "var(--color-text-secondary)", minWidth: "70px" }}>
                <span className="w-2 h-2 rounded-full bg-[var(--color-text-muted)] inline-block"></span>
                Mask Iso
              </span>
              <input
                type="range"
                min="0.01"
                max="1"
                step="0.01"
                value={isoThreshold}
                onChange={(e) => setIsoThreshold(parseFloat(e.target.value))}
                className="mask-slider flex-1 h-1 rounded-lg appearance-none cursor-pointer"
                style={{ background: sliderBg(isoThreshold, 0.01, 1, "#9ca3af") }}
              />
              <span className="text-[var(--color-text-secondary)] font-mono" style={{ fontSize: "10px", minWidth: "32px", textAlign: "right" }}>
                {isoThreshold.toFixed(2)}
              </span>

              <div className="w-px h-3 bg-[var(--color-border)] mx-1"></div>

              <span className="text-[var(--color-text-secondary)] whitespace-nowrap" style={{ fontSize: "10px", fontWeight: 500 }}>
                Opacity
              </span>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={maskOpacity}
                onChange={(e) => setMaskOpacity(parseFloat(e.target.value))}
                className="mask-slider h-1 rounded-lg appearance-none cursor-pointer"
                style={{ width: "80px", background: sliderBg(maskOpacity, 0.1, 1, "#9ca3af") }}
              />
              <span className="text-[var(--color-text-secondary)] font-mono" style={{ fontSize: "10px", minWidth: "28px", textAlign: "right" }}>
                {Math.round(maskOpacity * 100)}%
              </span>
            </div>
          )}

          {/* Row 3: Map isosurface + opacity (full width) */}
          {sourceMapPath && showMap && (
            <div className="px-3 py-1 flex items-center gap-2 border-t border-[var(--color-border)]">
              <span className="flex items-center gap-1.5 whitespace-nowrap" style={{ fontSize: "10px", fontWeight: 500, color: "#3b82f6", minWidth: "70px" }}>
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                Map Iso
              </span>
              <input
                type="range"
                min="0.5"
                max="5"
                step="0.1"
                value={mapThreshold}
                onChange={(e) => setMapThreshold(parseFloat(e.target.value))}
                className="map-slider flex-1 h-1 rounded-lg appearance-none cursor-pointer"
                style={{ background: sliderBg(mapThreshold, 0.5, 5, "#3b82f6") }}
              />
              <span className="text-blue-500 font-mono" style={{ fontSize: "10px", minWidth: "32px", textAlign: "right" }}>
                {mapThreshold.toFixed(1)}σ
              </span>

              <div className="w-px h-3 bg-[var(--color-border)] mx-1"></div>

              <span className="text-[var(--color-text-secondary)] whitespace-nowrap" style={{ fontSize: "10px", fontWeight: 500 }}>
                Opacity
              </span>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={mapOpacity}
                onChange={(e) => setMapOpacity(parseFloat(e.target.value))}
                className="map-slider h-1 rounded-lg appearance-none cursor-pointer"
                style={{ width: "80px", background: sliderBg(mapOpacity, 0.1, 1, "#3b82f6") }}
              />
              <span className="text-blue-500 font-mono" style={{ fontSize: "10px", minWidth: "28px", textAlign: "right" }}>
                {Math.round(mapOpacity * 100)}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* 3D Viewer */}
      <div className="relative" style={{ height: "480px" }}>
        <div
          ref={containerRef}
          style={{
            width: "100%",
            height: "100%",
            position: "relative",
            backgroundColor: "#1e1e1e",
          }}
        />

        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90">
            <BiLoader className="animate-spin text-blue-500 text-4xl mb-3" />
            <p className="text-white text-sm">Loading 3D mask...</p>
          </div>
        )}

        {error && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/95">
            <FiAlertCircle className="text-red-500 text-4xl mb-3" />
            <p className="text-[var(--color-text-muted)] text-sm mb-4 max-w-md text-center px-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-lg text-sm font-medium transition-colors"
            >
              <FiRefreshCw size={14} />
              Retry
            </button>
          </div>
        )}
      </div>

      {/* Hide Molstar UI elements + slider styling */}
      <style>{`
        .msp-plugin .msp-layout-left,
        .msp-plugin .msp-layout-right,
        .msp-plugin .msp-layout-top,
        .msp-plugin .msp-layout-bottom,
        .msp-plugin .msp-viewport-controls,
        .msp-plugin .msp-highlight-info,
        .msp-plugin .msp-log {
          display: none !important;
        }
        .msp-plugin .msp-viewport {
          position: absolute !important;
          inset: 0 !important;
        }
        .mask-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #9ca3af;
          cursor: pointer;
          border: 2px solid #fff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        .mask-slider::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #9ca3af;
          cursor: pointer;
          border: 2px solid #fff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        .map-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #fff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        .map-slider::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #fff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
      `}</style>
    </div>
  );
};

export default MolstarMaskViewer;
