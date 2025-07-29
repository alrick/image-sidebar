// main.ts
import { Plugin, WorkspaceLeaf, ItemView, TFile } from 'obsidian';

const VIEW_TYPE_IMAGE_SIDEBAR = 'image-sidebar-view';

// Interface pour les paramètres du plugin
interface ImageSidebarSettings {
    imageProperty: string; // Nom de la propriété qui contient le chemin de l'image
}

const DEFAULT_SETTINGS: ImageSidebarSettings = {
    imageProperty: 'image'
}

// Vue personnalisée pour afficher l'image
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
        return 'Image du fichier';
    }

    getIcon() {
        return 'image';
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.createEl('div', { 
            text: 'Aucune image à afficher',
            cls: 'image-sidebar-placeholder'
        });

        // Écouter les changements de fichier actif
        this.registerEvent(
            this.app.workspace.on('active-leaf-change', () => {
                this.updateImage();
            })
        );

        // Écouter les modifications de métadonnées
        this.registerEvent(
            this.app.metadataCache.on('changed', (file) => {
                const activeFile = this.app.workspace.getActiveFile();
                if (activeFile && file === activeFile) {
                    this.updateImage();
                }
            })
        );

        // Afficher l'image initiale
        this.updateImage();
    }

    async updateImage() {
        const container = this.containerEl.children[1];
        const activeFile = this.app.workspace.getActiveFile();

        if (!activeFile) {
            this.showPlaceholder(container, 'Aucun fichier ouvert');
            return;
        }

        // Récupérer les métadonnées du fichier
        const metadata = this.app.metadataCache.getFileCache(activeFile);
        const frontmatter = metadata?.frontmatter;

        if (!frontmatter || !frontmatter[this.plugin.settings.imageProperty]) {
            this.showPlaceholder(container, 'Aucune propriété "' + this.plugin.settings.imageProperty + '" trouvée');
            return;
        }

        const imagePath = frontmatter[this.plugin.settings.imageProperty];
        
        // Éviter de recharger la même image
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

        // Ajouter la fonctionnalité de glisser-déposer si pas d'image définie
        if (message.includes('Aucune propriété')) {
            this.setupDropZone(placeholder, container);
        }
        
        this.currentImagePath = null;
    }

    setupDropZone(placeholder: HTMLElement, container: Element) {
        // Modifier le texte pour indiquer le drag & drop
        placeholder.empty();
        placeholder.createEl('div', { text: 'Aucune image définie' });
        placeholder.createEl('div', { 
            text: 'Glissez-déposez une image ici',
            cls: 'image-sidebar-drop-hint'
        });
        
        placeholder.addClass('image-sidebar-dropzone');

        // Événements de drag & drop
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
            
            // Vérifier que c'est une image
            if (!file.type.startsWith('image/')) {
                this.showTemporaryMessage(container, 'Veuillez déposer un fichier image', 'error');
                return;
            }

            await this.handleImageDrop(file, container);
        });
    }

    async handleImageDrop(file: File, container: Element) {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            this.showTemporaryMessage(container, 'Aucun fichier ouvert', 'error');
            return;
        }

        try {
            // Afficher un indicateur de chargement
            this.showTemporaryMessage(container, 'Importation en cours...', 'loading');

            // Créer un nom de fichier unique
            const fileName = this.generateUniqueFileName(file.name);
            
            // Lire le fichier
            const arrayBuffer = await file.arrayBuffer();
            
            // Obtenir le chemin d'attachement et créer le dossier si nécessaire
            const attachmentPath = this.getAttachmentPath(fileName);
            await this.ensureAttachmentFolderExists(attachmentPath);
            
            // Sauvegarder dans le vault
            await this.app.vault.createBinary(attachmentPath, arrayBuffer);

            // Mettre à jour le frontmatter du fichier actuel
            await this.updateFileFrontmatter(activeFile, fileName);

            // Rafraîchir l'affichage
            setTimeout(() => this.updateImage(), 100);

        } catch (error) {
            console.error('Erreur lors de l\'importation:', error);
            this.showTemporaryMessage(container, 'Erreur lors de l\'importation', 'error');
        }
    }

    async ensureAttachmentFolderExists(filePath: string) {
        // Extraire le dossier du chemin complet
        const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
        
        if (folderPath && !this.app.vault.getAbstractFileByPath(folderPath)) {
            // Créer le dossier s'il n'existe pas
            await this.app.vault.createFolder(folderPath);
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

    getAttachmentPath(fileName: string): string {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            return fileName;
        }

        // Utiliser la même logique qu'Obsidian pour déterminer le dossier d'attachments
        const attachmentFolderPath = (this.app.vault as any).config?.attachmentFolderPath;
        
        if (!attachmentFolderPath || attachmentFolderPath === '/') {
            // Sauvegarder à la racine du vault
            return fileName;
        } else if (attachmentFolderPath === './') {
            // Sauvegarder dans le même dossier que le fichier actuel
            const activeFileFolder = activeFile.parent?.path || '';
            return activeFileFolder ? activeFileFolder + '/' + fileName : fileName;
        } else if (attachmentFolderPath.startsWith('./')) {
            // Chemin relatif au fichier actuel
            const activeFileFolder = activeFile.parent?.path || '';
            const relativePath = attachmentFolderPath.substring(2); // Enlever './'
            const fullPath = activeFileFolder ? activeFileFolder + '/' + relativePath : relativePath;
            return fullPath + '/' + fileName;
        } else {
            // Chemin absolu depuis la racine du vault
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
            // Frontmatter existe déjà
            const frontmatter = match[1];
            const propertyRegex = new RegExp('^' + this.plugin.settings.imageProperty + ':.*$', 'm');
            
            if (frontmatter.match(propertyRegex)) {
                // Remplacer la propriété existante
                const newFrontmatter = frontmatter.replace(propertyRegex, imageProperty);
                newContent = content.replace(frontmatterRegex, '---\n' + newFrontmatter + '\n---');
            } else {
                // Ajouter la propriété
                const newFrontmatter = frontmatter + '\n' + imageProperty;
                newContent = content.replace(frontmatterRegex, '---\n' + newFrontmatter + '\n---');
            }
        } else {
            // Créer un nouveau frontmatter
            newContent = '---\n' + imageProperty + '\n---\n\n' + content;
        }

        await this.app.vault.modify(file, newContent);
    }

    showTemporaryMessage(container: Element, message: string, type: 'loading' | 'error' | 'success' = 'loading') {
        container.empty();
        const messageEl = container.createEl('div', { 
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

            // Vérifier si c'est un lien Obsidian [[filename]]
            const obsidianLinkMatch = imagePath.match(/^\[\[(.+?)\]\]$/);
            if (obsidianLinkMatch) {
                cleanImagePath = obsidianLinkMatch[1];
                // Rechercher le fichier par nom dans tout le vault
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
                // Méthode classique avec chemin relatif/absolu
                imageFile = this.app.metadataCache.getFirstLinkpathDest(imagePath, activeFile.path);
            }
            
            if (!imageFile) {
                this.showPlaceholder(container, 'Image non trouvée: ' + cleanImagePath);
                return;
            }

            // Créer l'élément image
            const imageContainer = container.createEl('div', { cls: 'image-sidebar-container' });
            const img = imageContainer.createEl('img', { cls: 'image-sidebar-img' });
            
            // Obtenir l'URL de l'image
            const imageUrl = this.app.vault.getResourcePath(imageFile);
            img.src = imageUrl;
            img.alt = imagePath;

            // Ajouter le nom du fichier image
            imageContainer.createEl('div', { 
                text: imageFile.name,
                cls: 'image-sidebar-filename'
            });

            // Gestion des erreurs de chargement
            img.onerror = () => {
                this.showPlaceholder(container, 'Erreur de chargement: ' + imagePath);
            };

        } catch (error) {
            console.error('Erreur lors de l\'affichage de l\'image:', error);
            this.showPlaceholder(container, 'Erreur: ' + imagePath);
        }
    }

    async onClose() {
        // Nettoyage si nécessaire
    }
}

// Plugin principal
export default class ImageSidebarPlugin extends Plugin {
    settings: ImageSidebarSettings;

    async onload() {
        await this.loadSettings();

        // Enregistrer la vue personnalisée
        this.registerView(
            VIEW_TYPE_IMAGE_SIDEBAR,
            (leaf) => new ImageSidebarView(leaf, this)
        );

        // Ajouter une commande pour ouvrir la vue
        this.addCommand({
            id: 'open-image-sidebar',
            name: 'Ouvrir la sidebar d\'images',
            callback: () => {
                this.activateView();
            }
        });

        // Ajouter automatiquement la vue à la sidebar droite au démarrage
        this.app.workspace.onLayoutReady(() => {
            this.activateView();
        });
    }

    async activateView() {
        const { workspace } = this.app;

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE_IMAGE_SIDEBAR);

        if (leaves.length > 0) {
            // Activer la vue existante
            leaf = leaves[0];
        } else {
            // Créer une nouvelle vue dans la sidebar droite
            leaf = workspace.getRightLeaf(false);
            await leaf?.setViewState({ type: VIEW_TYPE_IMAGE_SIDEBAR, active: true });
        }

        // Révéler la vue
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