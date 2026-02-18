import React, { Suspense } from "react";
import "./JobBuilder.css";

const Import = React.lazy(() => import("./Tabs/Import"));
const MotionCorrection = React.lazy(() => import("./Tabs/MotionCorrection"));
const CtfEstimation = React.lazy(() => import("./Tabs/CtfEstimation"));
const ManualPicking = React.lazy(() => import("./Tabs/ManualPicking"));
const AutoPicker = React.lazy(() => import("./Tabs/AutoPicker"));
const ParticleExtraction = React.lazy(() => import("./Tabs/particleExtraction"));
const DClassification = React.lazy(() => import("./Tabs/2dClassification"));
const AutoRefine = React.lazy(() => import("./Tabs/AutoRefine"));
const Classification = React.lazy(() => import("./Tabs/3dClassification"));
const InitialModel = React.lazy(() => import("./Tabs/3dInitialModel"));
const MultiBody = React.lazy(() => import("./Tabs/3dMultiBody"));
const Subset = React.lazy(() => import("./Tabs/subset/Subset"));
const CtfRefine = React.lazy(() => import("./Tabs/CtfRefine"));
const Bayesian = React.lazy(() => import("./Tabs/Bayesian"));
const Mask = React.lazy(() => import("./Tabs/Mask"));
const PostProcessing = React.lazy(() => import("./Tabs/PostProcessing"));
const JoinStarFiles = React.lazy(() => import("./Tabs/joinStarFiles"));
const ParticleSubtraction = React.lazy(() => import("./Tabs/particleSubtraction"));
const LocalResolution = React.lazy(() => import("./Tabs/LocalResolution"));
const Dynamight = React.lazy(() => import("./Tabs/Dynamight"));
const ModelAngelo = React.lazy(() => import("./Tabs/ModelAngelo"));
const ManualSelect = React.lazy(() => import("./Tabs/ManualSelect"));

const LazyFallback = () => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "40px", color: "var(--color-text-muted)", fontSize: 13 }}>
    Loading...
  </div>
);

const JobBuilder = ({ selectedJob }) => {
  const renderFormContent = () => {
    switch (selectedJob) {
      case "Import":
        return <Import />;
      case "Motion Correction":
        return <MotionCorrection />;
      case "CTF Estimation":
        return <CtfEstimation />;
      case "Manual Picking":
        return <ManualPicking />;
      case "Auto-Picking":
        return <AutoPicker />;
      case "Particle extraction":
        return <ParticleExtraction />;
      case "Local resolution":
        return <LocalResolution />;
      case "2D classification":
        return <DClassification />;
      case "3D auto-refine":
        return <AutoRefine />;
      case "3D classification":
        return <Classification />;
      case "3D initial model":
        return <InitialModel />;
      case "3D multi-body":
        return <MultiBody />;
      case "Subset selection":
        return <Subset />;
      case "CTF refinement":
        return <CtfRefine />;
      case "Bayesian polishing":
        return <Bayesian />;
      case "Mask creation":
        return <Mask />;
      case "Post-processing":
        return <PostProcessing />;
      case "Join star files":
        return <JoinStarFiles />;
      case "Particle subtraction":
        return <ParticleSubtraction />;
      case "DynaMight flexibility":
        return <Dynamight />;
      case "ModelAngelo building":
        return <ModelAngelo />;
      case "Select Classes":
        return <ManualSelect />;
      default:
        return <p>Please select a job to display the form.</p>;
    }
  };

  return (
    <div className="main-component">
      <Suspense fallback={<LazyFallback />}>
        {renderFormContent()}
      </Suspense>
    </div>
  );
};

export default JobBuilder;
