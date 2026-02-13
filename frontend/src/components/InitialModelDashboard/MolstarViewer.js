import { useEffect, useRef, useState } from "react";
import { BiLoader } from "react-icons/bi";
import { FiAlertCircle, FiRefreshCw } from "react-icons/fi";
// Import Molstar CSS
import "molstar/build/viewer/molstar.css";

const API_BASE_URL = process.env.REACT_APP_API_HOST || "";

const MolstarViewer = ({
  jobId,
  iteration = "latest",
  classNum = 1,
  mrcFilePath = null,
  apiEndpoint = "/initialmodel/mrc/",
  isoValue = 1.5,
  colorByResolution = false,
  colorVolumeEndpoint = null, // Second MRC endpoint for resolution coloring (locres map)
  minResolution = null, // Min resolution in Å (for color scale domain)
  maxResolution = null, // Max resolution in Å (for color scale domain)
}) => {
  const containerRef = useRef(null);
  const pluginRef = useRef(null);
  const reprRefId = useRef(null); // Store representation cell ref for dynamic iso updates
  const stateTransformsRef = useRef(null); // Store StateTransforms for updates
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentIso, setCurrentIso] = useState(isoValue);

  // Build MRC URL for a given endpoint (auth via HttpOnly cookie)
  const buildMrcUrl = (endpoint) => {
    let path;

    if (mrcFilePath) {
      const sep = endpoint.includes("?") ? "&" : "?";
      path = `${endpoint}${sep}file_path=${encodeURIComponent(mrcFilePath)}`;
    } else {
      const params = new URLSearchParams({
        job_id: jobId,
        iteration: iteration,
        class: classNum,
      });
      const sep = endpoint.includes("?") ? "&" : "?";
      path = `${endpoint}${sep}${params.toString()}`;
    }

    return `${API_BASE_URL}${path}`;
  };

  const getMrcUrl = () => buildMrcUrl(apiEndpoint);

  useEffect(() => {
    if (!containerRef.current) return;
    if (!jobId && !mrcFilePath) return;

    let disposed = false;

    const initAndLoad = async () => {
      try {
        setLoading(true);
        setError(null);

        // Dispose existing plugin first to prevent duplicate maps
        if (pluginRef.current) {
          try {
            pluginRef.current.dispose();
          } catch (e) {
            console.warn("Error disposing previous plugin:", e);
          }
          pluginRef.current = null;
        }

        // Dynamic imports
        const { createPluginUI } = await import("molstar/lib/mol-plugin-ui");
        const { renderReact18 } = await import("molstar/lib/mol-plugin-ui/react18");
        const { DefaultPluginUISpec } = await import("molstar/lib/mol-plugin-ui/spec");
        const { PluginCommands } = await import("molstar/lib/mol-plugin/commands");
        const { StateTransforms } = await import("molstar/lib/mol-plugin-state/transforms");
        const { createVolumeRepresentationParams } = await import(
          "molstar/lib/mol-plugin-state/helpers/volume-representation-params"
        );

        if (disposed) return;

        // Clear container completely
        if (containerRef.current) {
          containerRef.current.innerHTML = "";
        }

        // Create plugin
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
            components: {
              remoteState: "none",
            },
          },
        });

        if (disposed) {
          plugin.dispose();
          return;
        }

        pluginRef.current = plugin;

        // Helper: extract volume ref and data from a Molstar parsed result
        const extractVolume = (parsedResult, skipRefs = new Set()) => {
          let vol = parsedResult.volume || parsedResult.volumes?.[0] || parsedResult;
          let vRef = null;
          let vData = null;

          try {
            if (vol?.ref && !skipRefs.has(vol.ref)) {
              vRef = vol.ref;
              const cell = plugin.state.data.cells.get(vol.ref);
              if (cell?.obj?.data) vData = cell.obj.data;
            } else if (vol?.cell?.transform?.ref && !skipRefs.has(vol.cell.transform.ref)) {
              vRef = vol.cell.transform.ref;
              vData = vol.cell?.obj?.data;
            } else if (parsedResult?.ref && !skipRefs.has(parsedResult.ref)) {
              vRef = parsedResult.ref;
              const cell = plugin.state.data.cells.get(parsedResult.ref);
              if (cell?.obj?.data) vData = cell.obj.data;
            }

            if (!vRef) {
              for (const [ref, cell] of plugin.state.data.cells) {
                if (skipRefs.has(ref)) continue;
                if (cell?.obj?.type?.name === 'Volume' || cell?.obj?.label === 'Volume') {
                  vRef = ref;
                  vData = cell.obj.data;
                  break;
                }
              }
            }
          } catch (e) {
            console.warn("Error accessing volume data:", e);
          }

          return { vRef, vData };
        };

        // Load primary MRC volume
        const url = getMrcUrl();

        const data = await plugin.builders.data.download(
          { url, isBinary: true, label: "density" },
          { state: { isGhost: true } }
        );

        if (disposed) return;

        const parsed = await plugin.dataFormats.get("ccp4").parse(plugin, data);
        const { vRef: volumeRef, vData: volumeData } = extractVolume(parsed);


        if (!volumeRef) {
          throw new Error("Failed to get volume reference for rendering. The MRC file may be invalid or missing.");
        }

        const repr = plugin.build();
        const volumeSelector = typeof volumeRef === 'string' ? { ref: volumeRef } : volumeRef;

        if (colorByResolution && colorVolumeEndpoint) {
          // Resolution coloring: load locres map as second volume, use external-volume color theme
          const colorUrl = buildMrcUrl(colorVolumeEndpoint);

          const colorDownload = await plugin.builders.data.download(
            { url: colorUrl, isBinary: true, label: "locres" },
            { state: { isGhost: true } }
          );

          if (disposed) return;

          const colorParsed = await plugin.dataFormats.get("ccp4").parse(plugin, colorDownload);
          const { vRef: locresRef, vData: locresData } = extractVolume(
            colorParsed,
            new Set([volumeRef])
          );


          if (!locresRef || !locresData) {
            console.warn("Failed to load locres volume, falling back to uniform color");
            // Fallback to uniform blue
            const reprParams = createVolumeRepresentationParams(plugin, volumeData, {
              type: "isosurface",
              typeParams: {
                isoValue: { kind: "relative", relativeValue: 1.5 },
                alpha: 0.9,
              },
              color: "uniform",
              colorParams: { value: 0x3b82f6 },
            });
            repr.to(volumeSelector).apply(
              StateTransforms.Representation.VolumeRepresentation3D,
              reprParams
            );
          } else {
            // Use external-volume color theme: filtered map isosurface colored by locres map values
            // Resolution color scale: blue (high res / low Å) -> red (low res / high Å)
            const resolutionColors = [0x0000FF, 0x00FFFF, 0x00FF00, 0xFFFF00, 0xFF0000];

            const domainParams = (minResolution != null && maxResolution != null)
              ? { name: 'custom', params: [minResolution, maxResolution] }
              : { name: 'auto', params: { symmetric: false } };

            const reprParams = createVolumeRepresentationParams(plugin, volumeData, {
              type: "isosurface",
              typeParams: {
                isoValue: { kind: "relative", relativeValue: 1.5 },
                alpha: 0.9,
              },
              color: "external-volume",
              colorParams: {
                volume: { ref: locresRef, getValue: () => locresData },
                coloring: {
                  name: 'absolute-value',
                  params: {
                    domain: domainParams,
                    list: { kind: 'interpolate', colors: resolutionColors },
                  },
                },
                defaultColor: 0xcccccc,
                normalOffset: 0,
                usePalette: false,
              },
            });


            repr.to(volumeSelector).apply(
              StateTransforms.Representation.VolumeRepresentation3D,
              reprParams
            );
          }

          await repr.commit();
        } else {
          // Standard density map with uniform color
          const reprParams = createVolumeRepresentationParams(plugin, volumeData, {
            type: "isosurface",
            typeParams: {
              isoValue: { kind: "relative", relativeValue: isoValue },
              alpha: 0.85,
            },
            color: "uniform",
            colorParams: { value: 0x3b82f6 },
          });

          repr.to(volumeSelector).apply(
            StateTransforms.Representation.VolumeRepresentation3D,
            reprParams
          );

          await repr.commit();
        }

        // Store the representation ref for dynamic iso updates
        stateTransformsRef.current = StateTransforms;
        const volRefStr = typeof volumeRef === 'string' ? volumeRef : volumeRef.ref;
        for (const [ref, cell] of plugin.state.data.cells) {
          if (cell?.transform?.parent === volRefStr &&
              cell?.transform?.transformer?.id === StateTransforms.Representation.VolumeRepresentation3D.id) {
            reprRefId.current = ref;
            break;
          }
        }

        await PluginCommands.Camera.Reset(plugin, {});

        if (!disposed) {
          setLoading(false);
        }
      } catch (err) {
        console.error("Error loading volume:", err);
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
  }, [jobId, iteration, classNum, mrcFilePath, apiEndpoint, isoValue, colorByResolution, colorVolumeEndpoint, minResolution, maxResolution]);

  // Dynamic iso value update without re-creating the plugin
  const handleIsoChange = async (newValue) => {
    setCurrentIso(newValue);
    const plugin = pluginRef.current;
    const reprId = reprRefId.current;
    const ST = stateTransformsRef.current;
    if (!plugin || !reprId || !ST) return;

    try {
      const update = plugin.state.data.build();
      update.to(reprId).update(
        ST.Representation.VolumeRepresentation3D,
        (old) => ({
          ...old,
          type: {
            ...old.type,
            params: {
              ...old.type.params,
              isoValue: { kind: "relative", relativeValue: newValue },
            },
          },
        })
      );
      await update.commit();
    } catch (e) {
      console.warn("Error updating isoValue:", e);
    }
  };

  return (
    <div className="relative">
      {/* Isosurface level slider - top bar */}
      {!loading && !error && (
        <div
          className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-200 dark:border-slate-700"
          style={{ backgroundColor: "var(--color-bg)" }}
        >
          <span className="text-gray-500 dark:text-slate-400 whitespace-nowrap" style={{ fontSize: "10px", fontWeight: 500 }}>
            Iso Level
          </span>
          <input
            type="range"
            min="0.1"
            max="5"
            step="0.1"
            value={currentIso}
            onChange={(e) => handleIsoChange(parseFloat(e.target.value))}
            className="flex-1 h-1 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #9ca3af 0%, #9ca3af ${((currentIso - 0.1) / 4.9) * 100}%, var(--color-border) ${((currentIso - 0.1) / 4.9) * 100}%, var(--color-border) 100%)`,
            }}
          />
          <span className="text-gray-500 dark:text-slate-400 font-mono" style={{ fontSize: "10px", minWidth: "32px", textAlign: "right" }}>
            {currentIso.toFixed(1)}σ
          </span>
        </div>
      )}

      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "500px",
          position: "relative",
          backgroundColor: "#1e1e1e",
          borderRadius: !loading && !error ? "0 0 8px 8px" : "8px",
          overflow: "hidden",
        }}
      />

      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 bg-opacity-75 rounded-lg">
          <BiLoader className="animate-spin text-blue-500 text-4xl mb-4" />
          <p className="text-white text-sm">Loading 3D density map...</p>
        </div>
      )}

      {error && !loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 bg-opacity-90 rounded-lg">
          <FiAlertCircle className="text-red-500 text-4xl mb-4" />
          <p className="text-white text-sm mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            <FiRefreshCw />
            Retry
          </button>
        </div>
      )}


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
        input[type="range"]::-webkit-slider-thumb {
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
        input[type="range"]::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #9ca3af;
          cursor: pointer;
          border: 2px solid #fff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
      `}</style>
    </div>
  );
};

export default MolstarViewer;
