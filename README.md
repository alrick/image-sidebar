# Obsidian Image Sidebar Plugin

Display images associated with your files directly in the right sidebar. This plugin reads a frontmatter property and shows the corresponding image, making it perfect for note-taking with visual references, character sheets, or any workflow where you want quick access to related images.

## Features

### 🖼️ **Image Display**
- Shows images based on frontmatter property (default: `image`)
- Supports Obsidian link notation: `[[image.png]]`
- Supports traditional file paths: `folder/image.jpg`
- Auto-detects image extensions: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`
- Real-time updates when switching files or editing frontmatter

### 🎯 **Drag & Drop**
- Drag images directly from your computer to the sidebar
- Automatically imports images to your vault
- Respects Obsidian's attachment folder settings
- Creates unique filenames to avoid conflicts
- Auto-updates frontmatter with the new image link

### ⚙️ **Smart Configuration**
- Uses Obsidian's attachment folder configuration
- Supports all attachment modes:
  - Vault root (`/`)
  - Same folder as file (`./`)
  - Relative paths (`./images`)
  - Absolute paths (`attachments`)
- Creates folders automatically when needed

## Installation

### Manual Installation
1. Download the latest release
2. Extract files to `.obsidian/plugins/image-sidebar/`
3. Enable the plugin in Obsidian settings

### Development Installation
```bash
# Clone to your plugins folder
cd .obsidian/plugins/
git clone [repository-url] image-sidebar
cd image-sidebar

# Install dependencies and build
npm install
npm run build

# Enable in Obsidian settings
```

## Usage

### Basic Usage
Add an `image` property to your frontmatter:

```yaml
---
title: My Character
image: "[[character-portrait.jpg]]"
---

# Character Description
...
```

The image will automatically appear in the right sidebar!

### Drag & Drop
1. Open a file without an image property
2. The sidebar shows "No image defined - Drag and drop an image here"
3. Drag an image file from your computer
4. The image is imported and the frontmatter is updated automatically

### Supported Formats

**Obsidian Links (Recommended):**
```yaml
image: "[[my-image.png]]"
```

**File Name Only:**
```yaml
image: "my-image.png"
```

**Relative Paths:**
```yaml
image: "images/my-image.jpg"
```

**Without Extension (auto-detection):**
```yaml
image: "my-image"
```

## Commands

- **Open image sidebar**: Opens or focuses the image sidebar

## Configuration

The plugin respects your Obsidian attachment settings:

1. Go to **Settings → Files & Links → Default location for new attachments**
2. Choose your preferred option:
   - **Vault folder**: Images saved to vault root
   - **Same folder as current file**: Images saved alongside your notes
   - **In subfolder under current folder**: Images saved in relative subfolders

The plugin will automatically use the same configuration!

## Screenshots

*Add screenshots here showing the plugin in action*

## Development

### Building the Plugin
```bash
npm run build
```

### Development Mode
```bash
npm run dev
```

### File Structure
```
image-sidebar/
├── main.ts           # Main plugin code
├── manifest.json     # Plugin metadata
├── styles.css        # Plugin styles
├── package.json      # Dependencies
├── tsconfig.json     # TypeScript config
└── esbuild.config.mjs # Build configuration
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Feature Ideas
- [ ] Multiple image support
- [ ] Image zoom/lightbox on click
- [ ] Custom property name configuration
- [ ] Image metadata display
- [ ] Thumbnail grid view

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you find this plugin helpful, consider:
- ⭐ Starring the repository
- 🐛 Reporting bugs via GitHub issues
- 💡 Suggesting features via GitHub issues
- ☕ [Buy me a coffee](your-link-here)

## Changelog

### v1.0.0
- Initial release
- Basic image display from frontmatter
- Support for Obsidian link notation `[[]]`
- Drag & drop functionality
- Automatic attachment folder detection
- Real-time updates