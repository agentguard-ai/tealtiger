# Social Preview Image Specifications

## Overview
Social preview images appear when sharing GitHub repositories on social media, Slack, Discord, etc. They should be visually appealing and clearly communicate the project's purpose.

## Technical Requirements
- **Dimensions**: 1280x640px (2:1 aspect ratio)
- **Format**: PNG
- **File Size**: Under 1MB
- **Location**: Upload via GitHub Settings > Social preview

## Design Specifications

### Main Repository Image
**File**: `tealtiger-social-preview.png`

**Content**:
- **Background**: Dark gradient (from #0f172a to #1e293b)
- **Logo/Icon**: TealTiger logo or shield icon (top-left or center)
- **Main Text**: "TealTiger"
  - Font: Bold, modern sans-serif (e.g., Inter, Poppins)
  - Size: 72-96px
  - Color: White (#ffffff)
- **Tagline**: "Powerful protection for AI agents"
  - Font: Regular sans-serif
  - Size: 36-48px
  - Color: Teal accent (#14b8a6) or light gray (#cbd5e1)
- **Features** (optional, small icons with text):
  - 🛡️ Client-side guardrails
  - 💰 Cost tracking
  - 🔒 Security enforcement
- **Footer**: "Open Source • TypeScript & Python"
  - Font: Small, 18-24px
  - Color: Gray (#94a3b8)

### TypeScript SDK Image
**File**: `tealtiger-sdk-social-preview.png`

**Content**:
- **Background**: Dark gradient with subtle code pattern
- **Logo**: TealTiger logo + TypeScript logo
- **Main Text**: "TealTiger SDK"
- **Subtitle**: "TypeScript / JavaScript"
- **Tagline**: "Drop-in AI security for Node.js"
- **Code Snippet** (optional):
  ```typescript
  import { TealOpenAI } from 'tealtiger';
  const client = new TealOpenAI({...});
  ```
- **Badges**: npm, TypeScript, MIT License

### Python SDK Image
**File**: `tealtiger-python-social-preview.png`

**Content**:
- **Background**: Dark gradient with subtle code pattern
- **Logo**: TealTiger logo + Python logo
- **Main Text**: "TealTiger Python"
- **Subtitle**: "Python SDK"
- **Tagline**: "AI security for Python applications"
- **Code Snippet** (optional):
  ```python
  from tealtiger import TealOpenAI
  client = TealOpenAI(...)
  ```
- **Badges**: PyPI, Python, MIT License

## Color Palette

### Primary Colors
- **Teal**: #14b8a6 (primary brand color)
- **Dark Teal**: #0d9488
- **Light Teal**: #5eead4

### Background Colors
- **Dark Blue**: #0f172a (slate-900)
- **Medium Dark**: #1e293b (slate-800)
- **Accent Dark**: #334155 (slate-700)

### Text Colors
- **White**: #ffffff
- **Light Gray**: #cbd5e1 (slate-300)
- **Medium Gray**: #94a3b8 (slate-400)

## Design Tools

### Online Tools (Free)
1. **Canva** (https://canva.com)
   - Use "Custom dimensions" → 1280x640px
   - Search for "GitHub social preview" templates
   
2. **Figma** (https://figma.com)
   - Create new frame: 1280x640px
   - Export as PNG

3. **Photopea** (https://photopea.com)
   - Free Photoshop alternative
   - Create new project: 1280x640px

### Design Tips
- Keep text large and readable (will be displayed small on social media)
- Use high contrast (dark background, light text)
- Avoid small details that won't be visible when scaled down
- Test how it looks at smaller sizes (Twitter card, Slack preview)
- Include brand colors consistently across all images

## Upload Instructions

1. Go to GitHub repository settings
2. Scroll to "Social preview" section
3. Click "Edit" or "Upload an image"
4. Upload the PNG file (1280x640px)
5. Preview how it looks
6. Save changes

## Example Layout

```
┌─────────────────────────────────────────────────────────┐
│  [Logo]                                                 │
│                                                         │
│                    TealTiger                            │
│          Powerful protection for AI agents              │
│                                                         │
│    🛡️ Guardrails    💰 Cost Tracking    🔒 Security    │
│                                                         │
│              Open Source • TypeScript & Python          │
└─────────────────────────────────────────────────────────┘
```

## References
- GitHub Social Preview Guide: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview
- Open Graph Image Best Practices: https://www.opengraph.xyz/
