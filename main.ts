// main.ts
import { Plugin, WorkspaceLeaf, ItemView, TFile } from 'obsidian';

const VIEW_TYPE_IMAGE_SIDEBAR = 'image-sidebar-view';

// Interface for plugin settings
interface ImageSidebarSettings {
    imageProperty: string; // Name of the property containing the image path
}

const DEFAULT_SETTINGS: ImageSidebarSettings = {
    imageProperty: 'image'
}

// Custom view to display the image
class ImageSidebarView extends ItemView {
    plugin: ImageSidebarPlugin;
    currentImagePath: string | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: ImageSidebarPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType() {
        return VIEW_TYPE_IMAGE_SIDEBAR;
    }

    getDisplayText() {
        return 'File Image';
    }

    getIcon() {
        return 'image';
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.createEl('div', { 
            text: 'No image to display',
            cls: 'image-sidebar-placeholder'
        });

        // Listen for active file changes
        this.registerEvent(
            this.app.workspace.on('active-leaf-change', () => {
                this.updateImage();
            })
        );

        // Listen for metadata changes
        this.registerEvent(
            this.app.metadataCache.on('changed', (file) => {
                const activeFile = this.app.workspace.getActiveFile();
                if (activeFile && file === activeFile) {
                    this.updateImage();
                }
            })
        );

        // Display initial image
        this.updateImage();
    }

    async updateImage() {
        const container = this.containerEl.children[1];
        const activeFile = this.app.workspace.getActiveFile();

        if (!activeFile) {
            this.showPlaceholder(container, 'No file open');
            return;
        }

        // Get file metadata
        const metadata = this.app.metadataCache.getFileCache(activeFile);
        const frontmatter = metadata?.frontmatter;

        if (!frontmatter || !frontmatter[this.plugin.settings.imageProperty]) {
            this.showPlaceholder(container, 'No "' + this.plugin.settings.imageProperty + '" property found');
            return;
        }

        const imagePath = frontmatter[this.plugin.settings.imageProperty];
        
        // Avoid reloading the same image
        if (this.currentImagePath === imagePath) {
            return;
        }

        this.currentImagePath = imagePath;
        await this.displayImage(container, imagePath, activeFile);
    }

    showPlaceholder(container: Element, message: string) {
        container.empty();
        const placeholder = container.createEl('div', { 
            text: message,
            cls: 'image-sidebar-placeholder'
        });

        // Add drag & drop functionality if no image is defined
        if (message.includes('No "')) {
            this.setupDropZone(placeholder, container);
        }
        
        this.currentImagePath = null;
    }

    setupDropZone(placeholder: HTMLElement, container: Element) {
        // Modify text to indicate drag & drop
        placeholder.empty();
        placeholder.createEl('div', { text: 'No image defined' });
        placeholder.createEl('div', { 
            text: 'Drag and drop an image here',
            cls: 'image-sidebar-drop-hint'
        });
        
        placeholder.addClass('image-sidebar-dropzone');

        // Drag & drop events
        placeholder.addEventListener('dragover', (e) => {
            e.preventDefault();
            placeholder.addClass('image-sidebar-dragover');
        });

        placeholder.addEventListener('dragleave', (e) => {
            e.preventDefault();
            placeholder.removeClass('image-sidebar-dragover');
        });

        placeholder.addEventListener('drop', async (e) => {
            e.preventDefault();
            placeholder.removeClass('image-sidebar-dragover');
            
            const files = e.dataTransfer?.files;
            if (!files || files.length === 0) return;

            const file = files[0];
            
            // Check if it's an image
            if (!file.type.startsWith('image/')) {
                this.showTemporaryMessage(container, 'Please drop an image file', 'error');
                return;
            }

            await this.handleImageDrop(file, container);
        });
    }

    async handleImageDrop(file: File, container: Element) {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            this.showTemporaryMessage(container, 'No file open', 'error');
            return;
        }

        try {
            // Show loading indicator
            this.showTemporaryMessage(container, 'Importing...', 'loading');

            // Create unique filename
            const fileName = this.generateUniqueFileName(file.name);
            
            // Read file
            const arrayBuffer = await file.arrayBuffer();
            
            // Get attachment path and create folder if needed
            const attachmentPath = this.getAttachmentPath(fileName);
            await this.ensureAttachmentFolderExists(attachmentPath);
            
            // Save to vault
            await this.app.vault.createBinary(attachmentPath, arrayBuffer);

            // Update frontmatter of current file
            await this.updateFileFrontmatter(activeFile, fileName);

            // Refresh display
            setTimeout(() => this.updateImage(), 100);

        } catch (error) {
            console.error('Error during import:', error);
            this.showTemporaryMessage(container, 'Import error', 'error');
        }
    }

    generateUniqueFileName(originalName: string): string {
        const files = this.app.vault.getFiles();
        let fileName = originalName;
        let counter = 1;

        while (files.some(f => f.name === fileName)) {
            const nameParts = originalName.split('.');
            const extension = nameParts.pop();
            const baseName = nameParts.join('.');
            fileName = baseName + '_' + counter + '.' + extension;
            counter++;
        }

        return fileName;
    }

    async ensureAttachmentFolderExists(filePath: string) {
        // Extract folder from full path
        const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
        
        if (folderPath && !this.app.vault.getAbstractFileByPath(folderPath)) {
            // Create folder if it doesn't exist
            await this.app.vault.createFolder(folderPath);
        }
    }

    getAttachmentPath(fileName: string): string {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            return fileName;
        }

        // Use the same logic as Obsidian to determine attachment folder
        const attachmentFolderPath = (this.app.vault as any).config?.attachmentFolderPath;
        
        if (!attachmentFolderPath || attachmentFolderPath === '/') {
            // Save to vault root
            return fileName;
        } else if (attachmentFolderPath === './') {
            // Save in same folder as current file
            const activeFileFolder = activeFile.parent?.path || '';
            return activeFileFolder ? activeFileFolder + '/' + fileName : fileName;
        } else if (attachmentFolderPath.startsWith('./')) {
            // Path relative to current file
            const activeFileFolder = activeFile.parent?.path || '';
            const relativePath = attachmentFolderPath.substring(2); // Remove './'
            const fullPath = activeFileFolder ? activeFileFolder + '/' + relativePath : relativePath;
            return fullPath + '/' + fileName;
        } else {
            // Absolute path from vault root
            return attachmentFolderPath + '/' + fileName;
        }
    }

    async updateFileFrontmatter(file: TFile, imageName: string) {
        const content = await this.app.vault.read(file);
        const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
        const match = content.match(frontmatterRegex);

        let newContent: string;
        const imageProperty = this.plugin.settings.imageProperty + ': "[[' + imageName + ']]"';

        if (match) {
            // Frontmatter already exists
            const frontmatter = match[1];
            const propertyRegex = new RegExp('^' + this.plugin.settings.imageProperty + ':.*$', 'm');
            
            if (frontmatter.match(propertyRegex)) {
                // Replace existing property
                const newFrontmatter = frontmatter.replace(propertyRegex, imageProperty);
                newContent = content.replace(frontmatterRegex, '---\n' + newFrontmatter + '\n---');
            } else {
                // Add property
                const newFrontmatter = frontmatter + '\n' + imageProperty;
                newContent = content.replace(frontmatterRegex, '---\n' + newFrontmatter + '\n---');
            }
        } else {
            // Create new frontmatter
            newContent = '---\n' + imageProperty + '\n---\n\n' + content;
        }

        await this.app.vault.modify(file, newContent);
    }

    showTemporaryMessage(container: Element, message: string, type: 'loading' | 'error' | 'success' = 'loading') {
        container.empty();
        container.createEl('div', { 
            text: message,
            cls: 'image-sidebar-message image-sidebar-' + type
        });

        if (type !== 'loading') {
            setTimeout(() => {
                this.updateImage();
            }, 2000);
        }
    }

    async displayImage(container: Element, imagePath: string, activeFile: TFile) {
        container.empty();

        try {
            let imageFile: TFile | null = null;
            let cleanImagePath = imagePath;

            // Check if it's an Obsidian link [[filename]]
            const obsidianLinkMatch = imagePath.match(/^\[\[(.+?)\]\]$/);
            if (obsidianLinkMatch) {
                cleanImagePath = obsidianLinkMatch[1];
                // Search for file by name throughout the vault
                const files = this.app.vault.getFiles();
                imageFile = files.find(file => 
                    file.name === cleanImagePath || 
                    file.name === cleanImagePath + '.png' ||
                    file.name === cleanImagePath + '.jpg' ||
                    file.name === cleanImagePath + '.jpeg' ||
                    file.name === cleanImagePath + '.gif' ||
                    file.name === cleanImagePath + '.webp' ||
                    file.name === cleanImagePath + '.svg' ||
                    file.basename === cleanImagePath
                ) || null;
            } else {
                // Classic method with relative/absolute path
                imageFile = this.app.metadataCache.getFirstLinkpathDest(imagePath, activeFile.path);
            }
            
            if (!imageFile) {
                this.showPlaceholder(container, 'Image not found: ' + cleanImagePath);
                return;
            }

            // Create image element
            const imageContainer = container.createEl('div', { cls: 'image-sidebar-container' });
            const img = imageContainer.createEl('img', { cls: 'image-sidebar-img' });
            
            // Get image URL
            const imageUrl = this.app.vault.getResourcePath(imageFile);
            img.src = imageUrl;
            img.alt = imagePath;

            // Add image filename
            imageContainer.createEl('div', { 
                text: imageFile.name,
                cls: 'image-sidebar-filename'
            });

            // Handle loading errors
            img.onerror = () => {
                this.showPlaceholder(container, 'Loading error: ' + imagePath);
            };

        } catch (error) {
            console.error('Error displaying image:', error);
            this.showPlaceholder(container, 'Error: ' + imagePath);
        }
    }

    async onClose() {
        // Cleanup if needed
    }
}

// Main plugin
export default class ImageSidebarPlugin extends Plugin {
    settings: ImageSidebarSettings;

    async onload() {
        await this.loadSettings();

        // Register custom view
        this.registerView(
            VIEW_TYPE_IMAGE_SIDEBAR,
            (leaf) => new ImageSidebarView(leaf, this)
        );

        // Add command to open view
        this.addCommand({
            id: 'open-image-sidebar',
            name: 'Open image sidebar',
            callback: () => {
                this.activateView();
            }
        });

        // Automatically add view to right sidebar on startup
        this.app.workspace.onLayoutReady(() => {
            this.activateView();
        });
    }

    async activateView() {
        const { workspace } = this.app;

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE_IMAGE_SIDEBAR);

        if (leaves.length > 0) {
            // Activate existing view
            leaf = leaves[0];
        } else {
            // Create new view in right sidebar
            leaf = workspace.getRightLeaf(false);
            await leaf?.setViewState({ type: VIEW_TYPE_IMAGE_SIDEBAR, active: true });
        }

        // Reveal view
        if (leaf) {
            workspace.revealLeaf(leaf);
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}