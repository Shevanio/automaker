/**
 * File Picker Dialog
 *
 * Server-side file picker for selecting files (not directories).
 * Uses the same backend API as FileBrowserDialog but shows files.
 */

import { useState, useEffect, useCallback } from 'react';
import { Folder, FileText, Image, ChevronRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PathInput } from '@/components/ui/path-input';
import { apiPost } from '@/lib/api-fetch';
import { cn } from '@/lib/utils';

interface DirectoryEntry {
  name: string;
  path: string;
}

interface FileEntry {
  name: string;
  path: string;
}

interface BrowseResult {
  success: boolean;
  currentPath: string;
  parentPath: string | null;
  directories: DirectoryEntry[];
  files: FileEntry[];
  drives?: string[];
  error?: string;
  warning?: string;
}

interface FilePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (paths: string[]) => void;
  title?: string;
  description?: string;
  initialPath?: string;
  /** Allow selecting multiple files */
  allowMultiple?: boolean;
  /** File extensions to show (e.g., ['.md', '.txt']). If not provided, shows all files */
  fileExtensions?: string[];
}

export function FilePickerDialog({
  open,
  onOpenChange,
  onSelect,
  title = 'Select Files',
  description = 'Navigate to find files or paste a path directly',
  initialPath,
  allowMultiple = false,
  fileExtensions,
}: FilePickerDialogProps) {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [directories, setDirectories] = useState<DirectoryEntry[]>([]);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');

  // Filter files by extension if provided
  const filteredFiles = fileExtensions
    ? files.filter((file) => {
        const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
        return fileExtensions.some((allowed) => allowed.toLowerCase() === ext);
      })
    : files;

  // Determine file icon
  const getFileIcon = (filename: string) => {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'];
    if (imageExts.includes(ext)) {
      return <Image className="w-4 h-4" />;
    }
    return <FileText className="w-4 h-4" />;
  };

  const browseDirectory = useCallback(async (dirPath?: string) => {
    setLoading(true);
    setError('');
    setWarning('');

    try {
      const result = await apiPost<BrowseResult>('/api/fs/browse', {
        dirPath,
        includeFiles: true,
      });

      if (result.success) {
        setCurrentPath(result.currentPath);
        setParentPath(result.parentPath);
        setDirectories(result.directories);
        setFiles(result.files || []);
        setWarning(result.warning || '');
      } else {
        setError(result.error || 'Failed to browse directory');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load directory');
    } finally {
      setLoading(false);
    }
  }, []);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setCurrentPath('');
      setParentPath(null);
      setDirectories([]);
      setFiles([]);
      setSelectedFiles(new Set());
      setError('');
      setWarning('');
    }
  }, [open]);

  // Load initial path when dialog opens
  useEffect(() => {
    if (open && !currentPath) {
      browseDirectory(initialPath);
    }
  }, [open, currentPath, initialPath, browseDirectory]);

  const handleNavigateToParent = () => {
    if (parentPath) {
      browseDirectory(parentPath);
    }
  };

  const handleNavigateToDirectory = (dirPath: string) => {
    browseDirectory(dirPath);
  };

  const handleToggleFile = (filePath: string) => {
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(filePath)) {
      newSelection.delete(filePath);
    } else {
      if (allowMultiple) {
        newSelection.add(filePath);
      } else {
        newSelection.clear();
        newSelection.add(filePath);
      }
    }
    setSelectedFiles(newSelection);
  };

  const handleConfirm = () => {
    const selectedPaths = Array.from(selectedFiles);
    if (selectedPaths.length > 0) {
      onSelect(selectedPaths);
      onOpenChange(false);
    }
  };

  const handlePathChange = (newPath: string) => {
    browseDirectory(newPath);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* Path input */}
        <div className="space-y-2">
          <PathInput
            currentPath={currentPath}
            parentPath={parentPath}
            loading={loading}
            error={!!error}
            onNavigate={handlePathChange}
            onHome={() => browseDirectory(initialPath || '/')}
            placeholder="Enter directory path..."
          />
        </div>

        {/* Error/Warning */}
        {error && (
          <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">{error}</div>
        )}
        {warning && (
          <div className="p-3 bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 rounded-lg text-sm">
            {warning}
          </div>
        )}

        {/* File browser */}
        <div className="flex-1 overflow-y-auto border border-border rounded-lg">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {/* Parent directory */}
              {parentPath && (
                <button
                  onClick={handleNavigateToParent}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors text-left"
                >
                  <Folder className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">..</span>
                  <span className="text-muted-foreground text-sm ml-auto">Parent Directory</span>
                </button>
              )}

              {/* Directories */}
              {directories.map((dir) => (
                <button
                  key={dir.path}
                  onClick={() => handleNavigateToDirectory(dir.path)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors text-left group"
                >
                  <Folder className="w-5 h-5 text-blue-500" />
                  <span className="flex-1 truncate">{dir.name}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                </button>
              ))}

              {/* Files */}
              {filteredFiles.map((file) => {
                const isSelected = selectedFiles.has(file.path);
                return (
                  <button
                    key={file.path}
                    onClick={() => handleToggleFile(file.path)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors text-left',
                      isSelected && 'bg-primary/10 hover:bg-primary/20'
                    )}
                  >
                    {getFileIcon(file.name)}
                    <span className="flex-1 truncate">{file.name}</span>
                    {isSelected && (
                      <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full" />
                      </div>
                    )}
                  </button>
                );
              })}

              {/* Empty state */}
              {directories.length === 0 && filteredFiles.length === 0 && !parentPath && (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  <p>No files or directories found</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Selected count */}
        {selectedFiles.size > 0 && (
          <div className="text-sm text-muted-foreground">
            {selectedFiles.size} file{selectedFiles.size > 1 ? 's' : ''} selected
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={selectedFiles.size === 0}>
            Select {selectedFiles.size > 0 && `(${selectedFiles.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
