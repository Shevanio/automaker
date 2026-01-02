import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useAppStore } from '@/store/app-store';

// Extracted hooks
import {
  useSpecLoading,
  useSpecSave,
  useSpecGeneration,
  useMultiAgentAnalysis,
} from './spec-view/hooks';

// Extracted components
import { SpecHeader, SpecEditor, SpecEmptyState } from './spec-view/components';

// Extracted dialogs
import {
  CreateSpecDialog,
  RegenerateSpecDialog,
  MultiAgentAnalysisModal,
} from './spec-view/dialogs';

export function SpecView() {
  const { currentProject, appSpec } = useAppStore();

  // Loading state
  const { isLoading, specExists, loadSpec } = useSpecLoading();

  // Save state
  const { isSaving, hasChanges, saveSpec, handleChange, setHasChanges } = useSpecSave();

  // Generation state and handlers
  const {
    // Dialog visibility
    showCreateDialog,
    setShowCreateDialog,
    showRegenerateDialog,
    setShowRegenerateDialog,

    // Create state
    projectOverview,
    setProjectOverview,
    isCreating,
    generateFeatures,
    setGenerateFeatures,
    analyzeProjectOnCreate,
    setAnalyzeProjectOnCreate,
    featureCountOnCreate,
    setFeatureCountOnCreate,

    // Regenerate state
    projectDefinition,
    setProjectDefinition,
    isRegenerating,
    generateFeaturesOnRegenerate,
    setGenerateFeaturesOnRegenerate,
    analyzeProjectOnRegenerate,
    setAnalyzeProjectOnRegenerate,
    featureCountOnRegenerate,
    setFeatureCountOnRegenerate,

    // Feature generation
    isGeneratingFeatures,

    // Status
    currentPhase,
    errorMessage,

    // Handlers
    handleCreateSpec,
    handleRegenerate,
  } = useSpecGeneration({ loadSpec });

  // Multi-Agent Analysis state
  const [showMultiAgentModal, setShowMultiAgentModal] = useState(false);
  const {
    isRunning: isAnalyzing,
    hasStarted: hasAnalysisStarted,
    analysis,
    error: analysisError,
    agentProgress,
    runAnalysis,
    reset: resetAnalysis,
  } = useMultiAgentAnalysis({
    projectPath: currentProject?.path || '',
    onComplete: (analysis) => {
      console.log('Multi-agent analysis completed:', analysis);
    },
    onError: (error) => {
      console.error('Multi-agent analysis error:', error);
    },
  });

  const handleMultiAgentAnalysis = () => {
    resetAnalysis();
    setShowMultiAgentModal(true);
  };

  const handleApplyAnalysis = (analysisResult: any) => {
    // TODO: Apply the multi-agent analysis to the spec
    // This would involve formatting the combined_steps into a spec format
    console.log('Applying analysis:', analysisResult);
  };

  // Reset hasChanges when spec is reloaded
  // (This is needed because loadSpec updates appSpec in the store)

  // No project selected
  if (!currentProject) {
    return (
      <div className="flex-1 flex items-center justify-center" data-testid="spec-view-no-project">
        <p className="text-muted-foreground">No project selected</p>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center" data-testid="spec-view-loading">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Empty state - no spec exists
  if (!specExists) {
    return (
      <>
        <SpecEmptyState
          projectPath={currentProject.path}
          isCreating={isCreating}
          isRegenerating={isRegenerating}
          currentPhase={currentPhase}
          errorMessage={errorMessage}
          onCreateClick={() => setShowCreateDialog(true)}
        />

        <CreateSpecDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          projectOverview={projectOverview}
          onProjectOverviewChange={setProjectOverview}
          generateFeatures={generateFeatures}
          onGenerateFeaturesChange={setGenerateFeatures}
          analyzeProject={analyzeProjectOnCreate}
          onAnalyzeProjectChange={setAnalyzeProjectOnCreate}
          featureCount={featureCountOnCreate}
          onFeatureCountChange={setFeatureCountOnCreate}
          onCreateSpec={handleCreateSpec}
          isCreatingSpec={isCreating}
        />
      </>
    );
  }

  // Main view - spec exists
  return (
    <div className="flex-1 flex flex-col overflow-hidden content-bg" data-testid="spec-view">
      <SpecHeader
        projectPath={currentProject.path}
        isRegenerating={isRegenerating}
        isCreating={isCreating}
        isGeneratingFeatures={isGeneratingFeatures}
        isSaving={isSaving}
        hasChanges={hasChanges}
        currentPhase={currentPhase}
        errorMessage={errorMessage}
        onRegenerateClick={() => setShowRegenerateDialog(true)}
        onMultiAgentClick={handleMultiAgentAnalysis}
        onSaveClick={saveSpec}
      />

      <SpecEditor value={appSpec} onChange={handleChange} />

      <RegenerateSpecDialog
        open={showRegenerateDialog}
        onOpenChange={setShowRegenerateDialog}
        projectDefinition={projectDefinition}
        onProjectDefinitionChange={setProjectDefinition}
        generateFeatures={generateFeaturesOnRegenerate}
        onGenerateFeaturesChange={setGenerateFeaturesOnRegenerate}
        analyzeProject={analyzeProjectOnRegenerate}
        onAnalyzeProjectChange={setAnalyzeProjectOnRegenerate}
        featureCount={featureCountOnRegenerate}
        onFeatureCountChange={setFeatureCountOnRegenerate}
        onRegenerate={handleRegenerate}
        isRegenerating={isRegenerating}
        isGeneratingFeatures={isGeneratingFeatures}
      />

      <MultiAgentAnalysisModal
        open={showMultiAgentModal}
        onOpenChange={setShowMultiAgentModal}
        isRunning={isAnalyzing}
        hasStarted={hasAnalysisStarted}
        analysis={analysis}
        error={analysisError}
        agentProgress={agentProgress}
        onStart={runAnalysis}
        onApply={handleApplyAnalysis}
      />
    </div>
  );
}
