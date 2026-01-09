import { useState, useEffect } from 'react';
import { Spinner } from 'flowbite-react';
import {
  fetchMagicDashProjects,
  importMagicDashProject,
  formatProjectDate,
} from '../utils/magicdashImporter';

/**
 * MagicDash Import Modal
 *
 * Modal for browsing and importing AI Builder projects from MagicDash into Bricks.
 */
const MagicDashImportModal = ({ isOpen, onClose, onSuccess }) => {
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(null);
  const [error, setError] = useState(null);

  // Fetch projects when modal opens
  useEffect(() => {
    if (isOpen) {
      loadProjects();
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen && !isImporting) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, isImporting, onClose]);

  const loadProjects = async () => {
    setIsLoading(true);
    setError(null);

    const result = await fetchMagicDashProjects({ limit: 30 });

    if (result.success) {
      setProjects(result.projects);
    } else {
      setError(result.error || 'Failed to load projects');
    }

    setIsLoading(false);
  };

  const handleImport = async (project) => {
    setIsImporting(project.id);
    setError(null);

    const result = await importMagicDashProject(project.id);

    if (result.success) {
      onSuccess?.(result);
      onClose();
    } else {
      setError(result.error || 'Failed to import project');
    }

    setIsImporting(null);
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !isImporting) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center items-center w-full h-full bg-black bg-opacity-50"
      onClick={handleBackdropClick}
    >
      <div className="relative p-4 w-full max-w-lg max-h-[90vh]">
        {/* Modal content */}
        <div className="relative bg-white rounded-lg shadow dark:bg-gray-800 flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b rounded-t dark:border-gray-600">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-blue-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Import from MagicDash
              </h3>
            </div>
            <button
              type="button"
              className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center dark:hover:bg-gray-600 dark:hover:text-white"
              onClick={onClose}
              disabled={isImporting}
            >
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="p-4 overflow-y-auto flex-1">
            {/* Error message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg dark:bg-red-900/20 dark:border-red-800 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Loading state */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-12">
                <Spinner size="lg" />
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                  Loading your projects...
                </p>
              </div>
            )}

            {/* Empty state */}
            {!isLoading && projects.length === 0 && !error && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <svg
                  className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
                <p className="text-gray-500 dark:text-gray-400">
                  No projects found
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  Create projects at{' '}
                  <a
                    href="https://app.magicplugins.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    app.magicplugins.io
                  </a>
                </p>
              </div>
            )}

            {/* Projects grid */}
            {!isLoading && projects.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => handleImport(project)}
                    disabled={isImporting}
                    className={`
                      relative p-3 text-left rounded-lg border transition-all duration-200
                      ${
                        isImporting === project.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }
                      ${isImporting && isImporting !== project.id ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    {/* Loading overlay */}
                    {isImporting === project.id && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-800/80 rounded-lg">
                        <Spinner size="sm" />
                      </div>
                    )}

                    {/* Project icon */}
                    <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center mb-2">
                      <svg
                        className="w-4 h-4 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                        />
                      </svg>
                    </div>

                    {/* Project title */}
                    <h4 className="font-medium text-sm text-gray-900 dark:text-white truncate">
                      {project.title || 'Untitled Project'}
                    </h4>

                    {/* Project date */}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {formatProjectDate(project.updatedAt)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 border-t dark:border-gray-600">
            <button
              type="button"
              onClick={loadProjects}
              disabled={isLoading || isImporting}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50 flex items-center gap-1"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Refresh
            </button>

            <a
              href="https://app.magicplugins.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
            >
              Open MagicDash
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MagicDashImportModal;
