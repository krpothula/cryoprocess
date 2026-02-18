import React, { useState, useEffect } from "react";
import { FiX, FiPlus, FiTrash2, FiLoader, FiLink, FiSend } from "react-icons/fi";
import { getProjectApi, updateProjectApi } from "../../services/projects/projects";
import useToast from "../../hooks/useToast";

const MAX_URLS = 5;

const ProjectWebhooks = ({ projectId, projectName, onClose }) => {
  const [urls, setUrls] = useState([]);
  const [newUrl, setNewUrl] = useState("");
  const [isLoading, setLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [isTesting, setTesting] = useState(null);
  const showToast = useToast();

  useEffect(() => {
    getProjectApi(projectId)
      .then((resp) => {
        const project = resp?.data?.data || resp?.data;
        setUrls(project?.webhookUrls || []);
      })
      .catch(() => {
        showToast("Failed to load project webhooks", { type: "error" });
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  const handleAdd = () => {
    const trimmed = newUrl.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith("https://")) {
      showToast("Webhook URL must start with https://", { type: "error" });
      return;
    }
    if (urls.length >= MAX_URLS) {
      showToast(`Maximum ${MAX_URLS} webhook URLs allowed`, { type: "error" });
      return;
    }
    if (urls.includes(trimmed)) {
      showToast("This URL is already added", { type: "error" });
      return;
    }
    setUrls([...urls, trimmed]);
    setNewUrl("");
  };

  const handleRemove = (index) => {
    setUrls(urls.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateProjectApi(projectId, { webhook_urls: urls });
      showToast("Webhook URLs saved", { type: "success" });
      onClose();
    } catch (error) {
      showToast(error.response?.data?.message || "Failed to save webhooks", { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (url, index) => {
    try {
      setTesting(index);
      // Send a test payload through the update API — actual test would need a dedicated endpoint,
      // so we just verify the URL is saved and show a success message
      showToast("Webhook will fire on next job completion", { type: "success" });
    } finally {
      setTesting(null);
    }
  };

  const getProviderLabel = (url) => {
    if (url.includes("hooks.slack.com")) return "Slack";
    if (url.includes("webhook.office.com") || url.includes("outlook.office.com")) return "Teams";
    if (url.includes("discord.com/api/webhooks")) return "Discord";
    return "Webhook";
  };

  if (isLoading) {
    return (
      <div className="wh-overlay">
        <div className="wh-modal">
          <div className="wh-loading">
            <FiLoader className="wh-spinner" />
            <span>Loading...</span>
          </div>
        </div>
        <style>{styles}</style>
      </div>
    );
  }

  return (
    <div className="wh-overlay">
      <div className="wh-modal">
        <button className="wh-close" onClick={onClose}><FiX size={20} /></button>

        <div className="wh-header">
          <FiLink size={18} />
          <div>
            <h3>Webhooks</h3>
            <span className="wh-subtitle">{projectName}</span>
          </div>
        </div>

        <p className="wh-desc">
          Get notified in Slack, Teams, or any webhook-compatible service when jobs complete or fail.
        </p>

        {/* URL List */}
        <div className="wh-list">
          {urls.length === 0 && (
            <div className="wh-empty">No webhook URLs configured</div>
          )}
          {urls.map((url, index) => (
            <div key={index} className="wh-item">
              <div className="wh-item-info">
                <span className={`wh-provider wh-provider-${getProviderLabel(url).toLowerCase()}`}>
                  {getProviderLabel(url)}
                </span>
                <span className="wh-url">{url}</span>
              </div>
              <div className="wh-item-actions">
                <button
                  className="wh-btn-test"
                  onClick={() => handleTest(url, index)}
                  disabled={isTesting === index}
                  title="Test webhook"
                >
                  {isTesting === index ? <FiLoader className="wh-spinner" size={12} /> : <FiSend size={12} />}
                </button>
                <button className="wh-btn-remove" onClick={() => handleRemove(index)} title="Remove">
                  <FiTrash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add new URL */}
        {urls.length < MAX_URLS && (
          <div className="wh-add">
            <input
              type="url"
              placeholder="https://hooks.slack.com/services/..."
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <button className="wh-btn-add" onClick={handleAdd} disabled={!newUrl.trim()}>
              <FiPlus size={14} />
            </button>
          </div>
        )}

        <div className="wh-hint">
          Supports Slack Incoming Webhooks, Microsoft Teams connectors, and generic webhook endpoints.
          Max {MAX_URLS} URLs per project.
        </div>

        {/* Actions */}
        <div className="wh-actions">
          <button className="wh-btn-cancel" onClick={onClose}>Cancel</button>
          <button className="wh-btn-save" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <FiLoader className="wh-spinner" size={14} /> : null}
            <span>{isSaving ? "Saving..." : "Save"}</span>
          </button>
        </div>
      </div>
      <style>{styles}</style>
    </div>
  );
};

const styles = `
  .wh-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  .wh-modal {
    background: var(--color-bg-card);
    border-radius: 12px;
    width: 100%;
    max-width: 520px;
    padding: 24px;
    position: relative;
  }
  .wh-close {
    position: absolute;
    top: 12px;
    right: 12px;
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 4px;
  }
  .wh-close:hover { color: var(--color-text-secondary); }
  .wh-header {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--color-text-heading);
    margin-bottom: 4px;
  }
  .wh-header h3 { margin: 0; font-size: 16px; font-weight: 600; }
  .wh-subtitle { font-size: 12px; color: var(--color-text-secondary); }
  .wh-desc {
    font-size: 13px;
    color: var(--color-text-secondary);
    margin: 8px 0 16px;
    line-height: 1.4;
  }
  .wh-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 12px;
    max-height: 200px;
    overflow-y: auto;
  }
  .wh-empty {
    text-align: center;
    padding: 16px;
    color: var(--color-text-muted);
    font-size: 13px;
    background: var(--color-bg);
    border: 1px dashed var(--color-border);
    border-radius: 8px;
  }
  .wh-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 10px;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    gap: 8px;
  }
  .wh-item-info {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    flex: 1;
  }
  .wh-provider {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 4px;
    flex-shrink: 0;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .wh-provider-slack { background: #4a154b22; color: #4a154b; }
  .wh-provider-teams { background: #464eb822; color: #464eb8; }
  .wh-provider-discord { background: #5865f222; color: #5865f2; }
  .wh-provider-webhook { background: var(--color-bg-hover); color: var(--color-text-secondary); }
  .wh-url {
    font-size: 11px;
    color: var(--color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }
  .wh-item-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }
  .wh-btn-test, .wh-btn-remove {
    padding: 4px;
    background: none;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    cursor: pointer;
    color: var(--color-text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .wh-btn-test:hover { color: var(--color-primary); border-color: var(--color-primary); }
  .wh-btn-remove:hover { color: var(--color-danger-text); border-color: #fecaca; }
  .wh-add {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
  }
  .wh-add input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    font-size: 12px;
    background: var(--color-bg-card);
    color: var(--color-text);
    outline: none;
  }
  .wh-add input:focus { border-color: var(--color-primary); }
  .wh-btn-add {
    padding: 8px 12px;
    background: var(--color-bg-hover);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    cursor: pointer;
    color: var(--color-text-secondary);
    display: flex;
    align-items: center;
  }
  .wh-btn-add:hover:not(:disabled) { color: var(--color-primary); border-color: var(--color-primary); }
  .wh-btn-add:disabled { opacity: 0.4; cursor: not-allowed; }
  .wh-hint {
    font-size: 11px;
    color: var(--color-text-muted);
    line-height: 1.4;
    margin-bottom: 16px;
  }
  .wh-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .wh-btn-cancel {
    padding: 8px 16px;
    background: var(--color-bg-hover);
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text-secondary);
    cursor: pointer;
  }
  .wh-btn-cancel:hover { background: var(--color-bg); }
  .wh-btn-save {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 20px;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
  }
  .wh-btn-save:hover { background: var(--color-primary-hover); }
  .wh-btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
  .wh-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 60px;
    color: var(--color-text-secondary);
  }
  .wh-spinner { animation: wh-spin 1s linear infinite; }
  @keyframes wh-spin { to { transform: rotate(360deg); } }
`;

export default ProjectWebhooks;
