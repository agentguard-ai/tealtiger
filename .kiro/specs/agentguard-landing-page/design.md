# Design Document: AgentGuard Landing Page

## Overview

The AgentGuard landing page is a single-page marketing website built with Next.js 14 (App Router), TypeScript, and Tailwind CSS. The design follows modern SaaS landing page patterns with a focus on developer experience, clear value proposition, and conversion optimization. The page architecture consists of distinct sections that guide visitors through awareness, consideration, and action stages of the conversion funnel.

The technical architecture leverages Next.js's static site generation (SSG) for optimal performance, with client-side hydration for interactive components. The design system uses Tailwind CSS for consistent styling and responsive layouts, with optional Framer Motion for smooth animations. All components are built with accessibility and SEO as first-class concerns.

### Key Design Principles

1. **Developer-First**: Code examples, technical accuracy, and GitHub-centric CTAs
2. **Performance**: Sub-2-second load times, optimized assets, minimal JavaScript
3. **Accessibility**: WCAG AA compliance, keyboard navigation, screen reader support
4. **Conversion-Focused**: Clear CTAs, social proof, minimal friction to GitHub
5. **Maintainability**: Component-based architecture, configuration-driven content

### Design Thinking Principles

The AgentGuard landing page design follows human-centered design thinking principles to create an effective developer experience:

#### 1. Empathize - Understanding Developer Pain Points

**User Research Insights**:
- Developers fear unexpected AI costs (the $50k bill scenario)
- Security concerns around PII leaks and prompt injection are top-of-mind
- Developers want quick implementation (drop-in solutions preferred)
- Trust is built through open-source transparency and social proof
- Code examples are more persuasive than marketing copy

**Design Response**:
- Lead with the problem (cost + security) before the solution
- Emphasize "drop-in" and "one SDK" in messaging
- Showcase GitHub stars and download metrics prominently
- Provide immediate code examples with before/after comparison
- Highlight "100% open source" throughout

#### 2. Define - Clear Problem Statement

**Core Problem**: Developers building AI applications need to prevent security vulnerabilities and cost overruns, but implementing these safeguards manually is complex and time-consuming.

**User Needs**:
- Quick understanding of what AgentGuard does (5-second rule)
- Evidence that it solves real problems (social proof)
- Confidence in ease of implementation (code examples)
- Trust in the solution (open source, community adoption)
- Clear path to get started (prominent GitHub CTA)

**Success Metrics**:
- Time to comprehension < 5 seconds
- GitHub click-through rate > 15%
- Bounce rate < 40%
- Average time on page > 90 seconds

#### 3. Ideate - Solution Exploration

**Design Patterns Considered**:

**Hero Section Approaches**:
- Option A: Video demo (rejected - increases load time)
- Option B: Animated illustration (selected - shows security + cost visually)
- Option C: Static screenshot (rejected - less engaging)

**Code Example Presentation**:
- Option A: Single language only (rejected - limits audience)
- Option B: Separate pages per language (rejected - adds friction)
- Option C: Tabbed interface (selected - accommodates both audiences)

**Social Proof Display**:
- Option A: Static numbers (rejected - becomes outdated)
- Option B: Live API fetching (selected - always current, builds trust)
- Option C: Testimonials only (rejected - need quantitative proof)

**Navigation Strategy**:
- Option A: Multi-page site (rejected - adds complexity)
- Option B: Single-page with smooth scroll (selected - maintains flow)
- Option C: Sidebar navigation (rejected - not common for landing pages)

#### 4. Prototype - Iterative Design

**Design Iterations**:

**Iteration 1 - Initial Concept**:
- Focus: Feature list and benefits
- Feedback: Too generic, doesn't address specific pain points
- Change: Added Problem section with $50k story

**Iteration 2 - Problem-Focused**:
- Focus: Lead with problems, then solution
- Feedback: Good, but needs proof it works
- Change: Added social proof section with live metrics

**Iteration 3 - Trust-Building**:
- Focus: Social proof and code examples
- Feedback: Code examples need to show simplicity
- Change: Added before/after comparison to highlight ease

**Iteration 4 - Conversion-Optimized**:
- Focus: Clear CTAs and minimal friction
- Feedback: Multiple CTAs confusing
- Change: Prioritized "Get Started" (GitHub) as primary CTA

#### 5. Test - Validation Strategy

**Usability Testing Plan**:

**A/B Testing Opportunities**:
- Hero headline variations
- CTA button copy ("Get Started" vs "View on GitHub" vs "Try AgentGuard")
- Code example placement (above vs below features)
- Social proof metrics order (GitHub stars first vs downloads first)

**User Testing Scenarios**:
1. **5-Second Test**: Show page for 5 seconds, ask "What does this product do?"
2. **First Click Test**: Ask "Where would you click to start using AgentGuard?"
3. **Navigation Test**: Ask "How would you find code examples?"
4. **Comprehension Test**: Ask "What problems does AgentGuard solve?"

**Heuristic Evaluation Criteria**:
- **Visibility**: Is the value proposition immediately clear?
- **Match**: Does the design match developer expectations?
- **Control**: Can users easily navigate to desired information?
- **Consistency**: Are design patterns consistent throughout?
- **Error Prevention**: Are CTAs clear and unambiguous?
- **Recognition**: Are icons and symbols universally understood?
- **Flexibility**: Does the site work for both TypeScript and Python developers?
- **Aesthetic**: Does the design convey professionalism and trust?

**Feedback Loops**:
- Analytics tracking for conversion funnel analysis
- Heatmaps to understand user attention patterns
- Session recordings to identify friction points
- User surveys for qualitative feedback
- GitHub star rate as proxy for conversion success

#### Design Thinking Applied to Key Sections

**Hero Section**:
- **Empathize**: Developers scan quickly, need immediate clarity
- **Define**: Must communicate value in < 5 seconds
- **Ideate**: Headline + subheadline + visual + CTAs
- **Prototype**: Test headline variations
- **Test**: 5-second test for comprehension

**Problem Section**:
- **Empathize**: Developers relate to real stories (e.g., $50k bill)
- **Define**: Establish credibility by showing we understand their pain
- **Ideate**: Story-driven vs list-driven presentation
- **Prototype**: Combine story with structured problem list
- **Test**: Measure emotional resonance and engagement time

**Code Example Section**:
- **Empathize**: Developers trust code more than marketing copy
- **Define**: Must show simplicity and ease of integration
- **Ideate**: Before/after comparison to highlight value
- **Prototype**: Tabbed interface for multi-language support
- **Test**: Track copy button clicks as engagement metric

**Social Proof Section**:
- **Empathize**: Developers trust community adoption signals
- **Define**: Need quantitative proof of adoption
- **Ideate**: Live metrics vs static numbers
- **Prototype**: API integration for real-time data
- **Test**: Measure impact on conversion rate

#### Continuous Improvement Cycle

**Post-Launch Iteration Plan**:

**Week 1-2**: Monitor baseline metrics
- Page views, bounce rate, time on page
- CTA click-through rates
- GitHub star conversion rate

**Week 3-4**: Identify friction points
- Analyze heatmaps and session recordings
- Review user feedback and support questions
- Identify sections with high drop-off

**Month 2**: Implement improvements
- A/B test headline variations
- Optimize code examples based on copy rates
- Refine CTA placement and copy

**Month 3+**: Scale and optimize
- Add testimonials as they become available
- Expand comparison section with competitor data
- Create case studies for social proof

**Metrics-Driven Decisions**:
- If bounce rate > 50%: Revise hero section clarity
- If GitHub CTR < 10%: Test CTA placement and copy
- If time on page < 60s: Improve content engagement
- If mobile bounce > desktop: Optimize mobile experience

## Architecture

### Technology Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v3.4+
- **Animation**: Framer Motion (optional, lazy-loaded)
- **Syntax Highlighting**: Shiki or Prism.js
- **Icons**: Lucide React or Heroicons
- **Deployment**: Vercel (free tier)
- **Analytics**: Vercel Analytics or Plausible (privacy-focused)

### Project Structure

```
agentguard-landing/
├── app/
│   ├── layout.tsx           # Root layout with metadata
│   ├── page.tsx             # Main landing page
│   ├── globals.css          # Global styles and Tailwind imports
│   └── api/
│       └── metrics/
│           └── route.ts     # API route for fetching GitHub/npm/PyPI stats
├── components/
│   ├── sections/
│   │   ├── Hero.tsx
│   │   ├── Problem.tsx
│   │   ├── Solution.tsx
│   │   ├── CodeExample.tsx
│   │   ├── Features.tsx
│   │   ├── SocialProof.tsx
│   │   ├── Comparison.tsx
│   │   ├── CTA.tsx
│   │   └── Footer.tsx
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── CodeBlock.tsx
│   │   └── Tabs.tsx
│   └── ThemeProvider.tsx
├── lib/
│   ├── config.ts            # Site configuration and content
│   ├── metrics.ts           # Functions to fetch live metrics
│   └── utils.ts             # Utility functions
├── public/
│   ├── images/
│   └── icons/
├── tailwind.config.ts
├── next.config.js
└── package.json
```

### Rendering Strategy

- **Static Generation (SSG)**: All page content is pre-rendered at build time
- **Incremental Static Regeneration (ISR)**: Metrics API route revalidates every 3600 seconds (1 hour)
- **Client-Side Hydration**: Interactive components (tabs, copy buttons, theme toggle) hydrate on client
- **Progressive Enhancement**: Core content accessible without JavaScript

### Data Flow

1. **Build Time**: Static content from `lib/config.ts` is rendered into HTML
2. **Initial Load**: Pre-rendered HTML served instantly from CDN
3. **Hydration**: React hydrates interactive components
4. **Metrics Loading**: Client fetches live metrics from `/api/metrics` endpoint
5. **Fallback**: If metrics API fails, display cached values from build time

## Components and Interfaces

### Section Components

#### Hero Section

**Component**: `Hero.tsx`

**Props**: None (uses config)

**Structure**:
```typescript
interface HeroConfig {
  headline: string;
  subheadline: string;
  ctas: Array<{
    label: string;
    href: string;
    variant: 'primary' | 'secondary' | 'outline';
  }>;
  heroImage?: {
    src: string;
    alt: string;
  };
}
```

**Layout**:
- Two-column layout on desktop (text left, visual right)
- Single column on mobile (text above visual)
- Headline: 3xl-6xl font size, gradient text effect
- CTAs: Horizontal button group with primary emphasis on "Get Started"
- Hero visual: Animated SVG or optimized image showing security + cost concepts

**Interactions**:
- CTA buttons have hover states (scale, shadow, color shift)
- Hero visual has subtle animation on load (fade-in, slide-up)
- Smooth scroll to sections when clicking anchor links

#### Problem Section

**Component**: `Problem.tsx`

**Props**: None (uses config)

**Structure**:
```typescript
interface ProblemConfig {
  title: string;
  description: string;
  problems: Array<{
    icon: string;
    title: string;
    description: string;
  }>;
  story?: {
    title: string;
    content: string;
  };
}
```

**Layout**:
- Centered title and description
- Three-column grid on desktop (security, cost, connection)
- Single column on mobile
- Optional story callout box with distinct styling

**Visual Design**:
- Icons with warning/alert colors (red, orange)
- Dark background to emphasize severity
- Story callout uses border-left accent

#### Solution Section

**Component**: `Solution.tsx`

**Props**: None (uses config)

**Structure**:
```typescript
interface SolutionConfig {
  title: string;
  description: string;
  features: Array<{
    icon: string;
    title: string;
    description: string;
    details?: string[];
  }>;
}
```

**Layout**:
- Centered title and description
- Two-column grid on desktop, single column on mobile
- Each feature has icon, title, description, and optional bullet points
- Alternating layout (image-text, text-image) for visual interest

**Visual Design**:
- Icons with success/positive colors (green, blue)
- Light background to contrast with Problem section
- Feature cards with subtle hover effects

#### Code Example Section

**Component**: `CodeExample.tsx`

**Props**: None (uses config)

**Structure**:
```typescript
interface CodeExampleConfig {
  title: string;
  description: string;
  examples: {
    typescript: {
      before: string;
      after: string;
    };
    python: {
      before: string;
      after: string;
    };
  };
}
```

**Layout**:
- Centered title and description
- Language tabs (TypeScript, Python) above code blocks
- Side-by-side before/after comparison on desktop
- Stacked before/after on mobile
- Copy button in top-right of each code block

**Interactions**:
- Tab switching updates displayed code
- Copy button copies code to clipboard
- Success feedback on copy (checkmark icon, tooltip)
- Syntax highlighting with appropriate theme (light/dark mode aware)

**Implementation Details**:
- Use Shiki for syntax highlighting (supports both TS and Python)
- Code stored as strings in config file
- Copy functionality uses Clipboard API with fallback

#### Features Grid

**Component**: `Features.tsx`

**Props**: None (uses config)

**Structure**:
```typescript
interface FeaturesConfig {
  title: string;
  description: string;
  features: Array<{
    icon: string;
    title: string;
    description: string;
    category: 'security' | 'cost' | 'dx';
  }>;
}
```

**Layout**:
- Centered title and description
- 3-column grid on desktop, 2-column on tablet, 1-column on mobile
- Exactly 6 features displayed
- Each feature card has icon, title, and description

**Visual Design**:
- Cards with subtle border and hover effect
- Icons color-coded by category (red for security, green for cost, blue for DX)
- Consistent card height with flexbox

#### Social Proof Section

**Component**: `SocialProof.tsx`

**Props**: 
```typescript
interface SocialProofProps {
  initialMetrics?: MetricsData;
}

interface MetricsData {
  githubStars: number;
  npmDownloads: number;
  pypiDownloads: number;
  lastUpdated: string;
}
```

**Layout**:
- Centered title
- Three-column metric display on desktop
- Single column on mobile
- Optional testimonials carousel below metrics

**Interactions**:
- Metrics animate on scroll into view (count-up animation)
- Testimonials auto-rotate every 5 seconds
- Manual navigation arrows for testimonials

**Data Fetching**:
- Client-side fetch from `/api/metrics` on mount
- Display loading skeleton while fetching
- Fall back to `initialMetrics` if fetch fails
- Cache metrics in localStorage for 1 hour

#### Comparison Section

**Component**: `Comparison.tsx`

**Props**: None (uses config)

**Structure**:
```typescript
interface ComparisonConfig {
  title: string;
  description: string;
  comparisons: Array<{
    feature: string;
    agentguard: string | boolean;
    manual: string | boolean;
    competitor?: string | boolean;
  }>;
}
```

**Layout**:
- Centered title and description
- Table layout on desktop with sticky header
- Card-based layout on mobile (one comparison per card)
- Checkmarks for boolean values, text for string values

**Visual Design**:
- AgentGuard column highlighted with accent color
- Alternating row colors for readability
- Icons for boolean values (checkmark, X)

#### CTA Section

**Component**: `CTA.tsx`

**Props**: None (uses config)

**Structure**:
```typescript
interface CTAConfig {
  title: string;
  description: string;
  ctas: Array<{
    label: string;
    href: string;
    variant: 'primary' | 'secondary';
  }>;
}
```

**Layout**:
- Full-width section with gradient background
- Centered content with large title
- Horizontal button group
- Optional background pattern or illustration

**Visual Design**:
- High contrast to stand out
- Large, prominent buttons
- Gradient or solid accent background

#### Footer

**Component**: `Footer.tsx`

**Props**: None (uses config)

**Structure**:
```typescript
interface FooterConfig {
  links: {
    product: Array<{ label: string; href: string }>;
    resources: Array<{ label: string; href: string }>;
    social: Array<{ label: string; href: string; icon: string }>;
  };
  legal: {
    license: string;
    copyright: string;
  };
}
```

**Layout**:
- Four-column layout on desktop (Product, Resources, Social, Legal)
- Two-column on tablet, single column on mobile
- Logo and tagline at top
- Legal info at bottom

### UI Components

#### Button Component

**Component**: `Button.tsx`

**Props**:
```typescript
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'outline' | 'ghost';
  size: 'sm' | 'md' | 'lg';
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}
```

**Variants**:
- **Primary**: Solid background with accent color, white text
- **Secondary**: Solid background with secondary color
- **Outline**: Transparent background with border
- **Ghost**: Transparent background, no border

**States**:
- Default, Hover, Active, Focus, Disabled
- Focus state has visible outline for accessibility

#### Card Component

**Component**: `Card.tsx`

**Props**:
```typescript
interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'bordered' | 'elevated';
  padding?: 'sm' | 'md' | 'lg';
  className?: string;
}
```

**Variants**:
- **Default**: Subtle background, no border
- **Bordered**: Border with no shadow
- **Elevated**: Shadow with no border

#### CodeBlock Component

**Component**: `CodeBlock.tsx`

**Props**:
```typescript
interface CodeBlockProps {
  code: string;
  language: 'typescript' | 'python' | 'javascript' | 'bash';
  showLineNumbers?: boolean;
  highlightLines?: number[];
  filename?: string;
}
```

**Features**:
- Syntax highlighting with Shiki
- Copy button in top-right corner
- Optional line numbers
- Optional line highlighting
- Optional filename display
- Theme-aware (light/dark mode)

#### Tabs Component

**Component**: `Tabs.tsx`

**Props**:
```typescript
interface TabsProps {
  tabs: Array<{
    id: string;
    label: string;
    content: React.ReactNode;
  }>;
  defaultTab?: string;
  onChange?: (tabId: string) => void;
}
```

**Features**:
- Keyboard navigation (arrow keys)
- Active tab indicator (underline or background)
- Smooth content transition
- Accessible (ARIA roles and labels)

### Theme Provider

**Component**: `ThemeProvider.tsx`

**Functionality**:
- Detects system color scheme preference
- Provides theme toggle functionality
- Persists theme preference in localStorage
- Applies theme class to document root
- Prevents flash of unstyled content (FOUC)

**Context**:
```typescript
interface ThemeContext {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
}
```

## Data Models

### Configuration Model

All static content is stored in `lib/config.ts` for easy maintenance:

```typescript
export const siteConfig = {
  name: 'AgentGuard',
  description: 'Open-source security and cost tracking for AI applications',
  url: 'https://agentguard.dev',
  ogImage: 'https://agentguard.dev/og-image.png',
  links: {
    github: 'https://github.com/yourusername/agentguard',
    docs: 'https://docs.agentguard.dev',
    discord: 'https://discord.gg/agentguard',
    linkedin: 'https://linkedin.com/company/agentguard',
    devto: 'https://dev.to/agentguard',
  },
};

export const heroConfig: HeroConfig = {
  headline: 'Secure your AI. Control your costs. One SDK.',
  subheadline: 'Open-source security and cost tracking for AI applications',
  ctas: [
    { label: 'Get Started', href: siteConfig.links.github, variant: 'primary' },
    { label: 'View Docs', href: siteConfig.links.docs, variant: 'secondary' },
    { label: 'Try Demo', href: '#demo', variant: 'outline' },
  ],
};

// ... similar configs for other sections
```

### Metrics Model

```typescript
interface MetricsData {
  githubStars: number;
  npmDownloads: number;
  pypiDownloads: number;
  lastUpdated: string;
}

interface MetricsResponse {
  success: boolean;
  data?: MetricsData;
  error?: string;
  cached: boolean;
}
```

### API Integration

#### GitHub API

```typescript
async function fetchGitHubStars(repo: string): Promise<number> {
  const response = await fetch(`https://api.github.com/repos/${repo}`);
  const data = await response.json();
  return data.stargazers_count;
}
```

#### npm API

```typescript
async function fetchNpmDownloads(package: string): Promise<number> {
  const response = await fetch(
    `https://api.npmjs.org/downloads/point/last-month/${package}`
  );
  const data = await response.json();
  return data.downloads;
}
```

#### PyPI API

```typescript
async function fetchPyPiDownloads(package: string): Promise<number> {
  // PyPI doesn't have a direct downloads API
  // Use pypistats.org API or fallback to static value
  const response = await fetch(
    `https://pypistats.org/api/packages/${package}/recent`
  );
  const data = await response.json();
  return data.data.last_month;
}
```

## Styling and Design System

### Color Palette

**Light Mode**:
```css
--background: 0 0% 100%;
--foreground: 222.2 84% 4.9%;
--primary: 221.2 83.2% 53.3%;
--primary-foreground: 210 40% 98%;
--secondary: 210 40% 96.1%;
--secondary-foreground: 222.2 47.4% 11.2%;
--accent: 210 40% 96.1%;
--accent-foreground: 222.2 47.4% 11.2%;
--destructive: 0 84.2% 60.2%;
--border: 214.3 31.8% 91.4%;
--success: 142 76% 36%;
--warning: 38 92% 50%;
```

**Dark Mode**:
```css
--background: 222.2 84% 4.9%;
--foreground: 210 40% 98%;
--primary: 217.2 91.2% 59.8%;
--primary-foreground: 222.2 47.4% 11.2%;
--secondary: 217.2 32.6% 17.5%;
--secondary-foreground: 210 40% 98%;
--accent: 217.2 32.6% 17.5%;
--accent-foreground: 210 40% 98%;
--destructive: 0 62.8% 30.6%;
--border: 217.2 32.6% 17.5%;
--success: 142 71% 45%;
--warning: 38 92% 50%;
```

### Typography

**Font Stack**:
- **Headings**: Inter or Geist Sans (system font fallback)
- **Body**: Inter or Geist Sans
- **Code**: Geist Mono or Fira Code (monospace fallback)

**Scale**:
```css
--font-size-xs: 0.75rem;    /* 12px */
--font-size-sm: 0.875rem;   /* 14px */
--font-size-base: 1rem;     /* 16px */
--font-size-lg: 1.125rem;   /* 18px */
--font-size-xl: 1.25rem;    /* 20px */
--font-size-2xl: 1.5rem;    /* 24px */
--font-size-3xl: 1.875rem;  /* 30px */
--font-size-4xl: 2.25rem;   /* 36px */
--font-size-5xl: 3rem;      /* 48px */
--font-size-6xl: 3.75rem;   /* 60px */
```

### Spacing

Tailwind's default spacing scale (4px base unit):
- `space-1`: 0.25rem (4px)
- `space-2`: 0.5rem (8px)
- `space-4`: 1rem (16px)
- `space-6`: 1.5rem (24px)
- `space-8`: 2rem (32px)
- `space-12`: 3rem (48px)
- `space-16`: 4rem (64px)
- `space-24`: 6rem (96px)

### Breakpoints

```javascript
module.exports = {
  theme: {
    screens: {
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
  },
};
```

### Animation

**Transitions**:
- Default: 150ms ease-in-out
- Slow: 300ms ease-in-out
- Fast: 100ms ease-in-out

**Keyframes**:
```css
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slide-up {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes count-up {
  from { transform: scale(0.8); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
```

## SEO and Metadata

### Page Metadata

```typescript
export const metadata: Metadata = {
  title: 'AgentGuard - Secure your AI. Control your costs.',
  description: 'Open-source security and cost tracking for AI applications. Drop-in SDK for OpenAI, Anthropic, and Azure OpenAI with built-in guardrails and budget management.',
  keywords: ['AI security', 'cost control', 'OpenAI', 'Anthropic', 'guardrails', 'PII detection', 'prompt injection'],
  authors: [{ name: 'AgentGuard Team' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://agentguard.dev',
    title: 'AgentGuard - Secure your AI. Control your costs.',
    description: 'Open-source security and cost tracking for AI applications',
    siteName: 'AgentGuard',
    images: [
      {
        url: 'https://agentguard.dev/og-image.png',
        width: 1200,
        height: 630,
        alt: 'AgentGuard - AI Security and Cost Control',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AgentGuard - Secure your AI. Control your costs.',
    description: 'Open-source security and cost tracking for AI applications',
    images: ['https://agentguard.dev/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};
```

### Structured Data

```typescript
const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'AgentGuard',
  description: 'Open-source security and cost tracking for AI applications',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Cross-platform',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  author: {
    '@type': 'Organization',
    name: 'AgentGuard',
  },
};
```

## Performance Optimization

### Image Optimization

- Use Next.js `<Image>` component for automatic optimization
- Serve WebP format with JPEG/PNG fallback
- Implement lazy loading for below-the-fold images
- Use appropriate sizes and srcset for responsive images
- Compress images to <100KB each

### Code Splitting

- Lazy load Framer Motion only when animations are needed
- Lazy load syntax highlighter on code example scroll into view
- Split vendor bundles (React, Next.js separate from app code)
- Use dynamic imports for heavy components

### Caching Strategy

```javascript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, must-revalidate',
          },
        ],
      },
    ];
  },
};
```

### Bundle Size Optimization

- Tree-shake unused Tailwind classes
- Minimize third-party dependencies
- Use lightweight alternatives (e.g., Lucide instead of Font Awesome)
- Target bundle size: <200KB gzipped

## Accessibility

### Keyboard Navigation

- All interactive elements accessible via Tab key
- Visible focus indicators (2px outline with accent color)
- Skip-to-content link for screen readers
- Logical tab order following visual flow

### Screen Reader Support

- Semantic HTML (header, nav, main, section, footer)
- ARIA labels for icon-only buttons
- ARIA live regions for dynamic content (metrics loading)
- Alt text for all meaningful images
- Proper heading hierarchy (single h1, nested h2-h6)

### Color Contrast

- Minimum 4.5:1 for normal text
- Minimum 3:1 for large text (18px+ or 14px+ bold)
- Minimum 3:1 for UI components and graphics
- Test with tools like axe DevTools or WAVE

### Motion and Animation

- Respect `prefers-reduced-motion` media query
- Disable animations when user preference is set
- Provide alternative static states
- Ensure animations don't cause seizures (no rapid flashing)

## Error Handling

### API Failures

**Metrics API**:
- If GitHub API fails: Display cached value or fallback to 0
- If npm API fails: Display cached value or fallback to 0
- If PyPI API fails: Display cached value or fallback to 0
- Show "Last updated" timestamp to indicate data freshness
- Log errors to console for debugging

**Network Errors**:
- Implement retry logic with exponential backoff
- Maximum 3 retry attempts
- Display user-friendly error message if all retries fail
- Provide manual refresh button

### Client-Side Errors

- Implement error boundaries for React components
- Display fallback UI when component errors occur
- Log errors to error tracking service (e.g., Sentry)
- Provide "Report Issue" link in error UI

### Graceful Degradation

- Core content accessible without JavaScript
- CSS-only fallbacks for interactive elements
- Progressive enhancement for advanced features
- Ensure critical CTAs work without JavaScript (direct links)



## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Language Tab Switching

*For any* language tab in the Code Example Component, when a user clicks that tab, the component should display code in the corresponding language and mark that tab as active.

**Validates: Requirements 4.4**

### Property 2: Code Copy with Feedback

*For any* code block with a copy button, when the copy button is clicked, the code content should be copied to the clipboard AND visual feedback should be displayed to confirm the action.

**Validates: Requirements 4.6, 4.7**

### Property 3: Feature Completeness

*For any* feature displayed in the Features Grid, that feature should have an icon, a title, a description, and a category assignment (security, cost, or developer experience).

**Validates: Requirements 5.2, 5.3, 5.4**

### Property 4: API Metrics Fetching

*For any* social proof widget initialization, the widget should attempt to fetch live metrics from GitHub, npm, and PyPI APIs.

**Validates: Requirements 6.4**

### Property 5: API Failure Fallback

*For any* API request that fails in the Social Proof Widget, the widget should display cached or fallback values instead of showing an error or empty state.

**Validates: Requirements 6.5**

### Property 6: Conditional Testimonial Rendering

*For any* configuration where testimonials data exists, the Social Proof section should render those testimonials in the UI.

**Validates: Requirements 6.6**

### Property 7: CTA Link Navigation

*For any* CTA link in the CTA Section, clicking that link should navigate to the destination specified in its href attribute.

**Validates: Requirements 8.3**

### Property 8: Conditional Community Link Display

*For any* configuration where a Discord or community link exists, the CTA Section should display that link prominently.

**Validates: Requirements 8.4**

### Property 9: Responsive Layout Adaptation

*For any* viewport width, the landing page layout should adapt its content presentation to fit that viewport appropriately (no horizontal overflow, readable text, accessible interactive elements).

**Validates: Requirements 10.1**

### Property 10: Dark Mode System Preference

*For any* user whose system preference is set to dark mode, the landing page should automatically apply the dark color scheme on initial load.

**Validates: Requirements 11.1**

### Property 11: Dark Mode Contrast

*For any* text element when dark mode is active, the contrast ratio between text and background should meet WCAG standards (4.5:1 for normal text, 3:1 for large text).

**Validates: Requirements 11.2**

### Property 12: Dark Mode Syntax Highlighting

*For any* code block when dark mode is active, the syntax highlighting theme should use colors appropriate for dark backgrounds.

**Validates: Requirements 11.3**

### Property 13: Theme Toggle Functionality

*For any* current theme state (light or dark), when the theme toggle is clicked, the page should switch to the opposite theme.

**Validates: Requirements 11.4**

### Property 14: Theme Persistence

*For any* theme change (light to dark or dark to light), the new theme preference should be saved to browser localStorage.

**Validates: Requirements 11.5**

### Property 15: Image Format Optimization

*For any* image displayed on the landing page, the image should be served in WebP format with appropriate fallbacks for browsers that don't support WebP.

**Validates: Requirements 12.3**

### Property 16: Image Lazy Loading

*For any* image that is below the fold (not immediately visible), the image should have lazy loading attributes to defer loading until needed.

**Validates: Requirements 12.4**

### Property 17: Keyboard Focus Indicators

*For any* interactive element (button, link, input), when that element receives keyboard focus, a visible focus indicator should be displayed.

**Validates: Requirements 13.2**

### Property 18: ARIA Labels for Icon-Only Elements

*For any* interactive element that contains only an icon without visible text, that element should have an appropriate ARIA label for screen readers.

**Validates: Requirements 13.3**

### Property 19: Text Contrast Ratios

*For any* text element on the page, the contrast ratio between the text color and its background should meet WCAG AA standards (4.5:1 for normal text, 3:1 for large text).

**Validates: Requirements 13.4**

### Property 20: Image Alt Text

*For any* meaningful image (not decorative), the image element should have descriptive alt text.

**Validates: Requirements 13.5**

### Property 21: Heading Hierarchy

*For any* page render, there should be exactly one h1 element, and all heading elements should follow proper nesting order (h1 → h2 → h3, no skipping levels).

**Validates: Requirements 14.5**

### Property 22: Scroll Animation Trigger

*For any* content section with scroll animations enabled, when that section scrolls into the viewport, the animation should trigger with smooth transitions.

**Validates: Requirements 15.1**

### Property 23: CTA Button Hover Feedback

*For any* CTA button, when a user hovers over that button, visual feedback should be provided (color change, scale transformation, or shadow effect).

**Validates: Requirements 15.2**

### Property 24: Reduced Motion Preference

*For any* user with the "prefers-reduced-motion" system preference enabled, all animations on the landing page should be disabled or minimized.

**Validates: Requirements 15.4**

### Property 25: CTA Click Tracking

*For any* CTA button click, an analytics event should be tracked with appropriate labels identifying which CTA was clicked.

**Validates: Requirements 16.2**

### Property 26: Cookie Consent Conditional Display

*For any* configuration where cookie consent is required, the landing page should display a consent banner before initializing tracking.

**Validates: Requirements 16.5**

### Property 27: Static Asset Cache Headers

*For any* static asset (image, CSS, JavaScript), the HTTP response should include appropriate cache-control headers.

**Validates: Requirements 17.5**

## Testing Strategy

### Dual Testing Approach

The AgentGuard landing page will use both unit tests and property-based tests to ensure comprehensive coverage:

- **Unit Tests**: Verify specific examples, edge cases, component rendering, and integration points
- **Property Tests**: Verify universal properties across all inputs and states

Both testing approaches are complementary and necessary. Unit tests catch concrete bugs in specific scenarios, while property tests verify general correctness across many inputs.

### Testing Framework

- **Test Runner**: Vitest (fast, modern, TypeScript-native)
- **React Testing**: React Testing Library (user-centric testing)
- **Property-Based Testing**: fast-check (JavaScript/TypeScript property testing library)
- **E2E Testing**: Playwright (for critical user flows)
- **Accessibility Testing**: axe-core via jest-axe

### Unit Testing Strategy

Unit tests should focus on:

1. **Component Rendering**: Verify components render with correct content
2. **User Interactions**: Test button clicks, tab switches, form submissions
3. **Edge Cases**: Empty states, error states, loading states
4. **Integration Points**: API calls, localStorage, clipboard API
5. **Accessibility**: ARIA attributes, keyboard navigation, focus management

**Example Unit Tests**:
```typescript
describe('Hero Section', () => {
  it('displays the correct headline', () => {
    render(<Hero />);
    expect(screen.getByText('Secure your AI. Control your costs. One SDK.')).toBeInTheDocument();
  });

  it('renders all three CTA buttons', () => {
    render(<Hero />);
    expect(screen.getByRole('link', { name: 'Get Started' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View Docs' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Try Demo' })).toBeInTheDocument();
  });
});

describe('Code Example Component', () => {
  it('switches language when tab is clicked', () => {
    render(<CodeExample />);
    const pythonTab = screen.getByRole('tab', { name: 'Python' });
    fireEvent.click(pythonTab);
    expect(screen.getByText(/import agentguard/)).toBeInTheDocument();
  });

  it('handles empty code gracefully', () => {
    render(<CodeExample code="" language="typescript" />);
    expect(screen.getByTestId('code-block')).toBeEmptyDOMElement();
  });
});
```

### Property-Based Testing Strategy

Property tests should focus on:

1. **Universal Behaviors**: Properties that hold for all valid inputs
2. **State Transitions**: Theme switching, tab switching, modal states
3. **Data Transformations**: Metrics formatting, date formatting
4. **Invariants**: Heading hierarchy, accessibility requirements
5. **Error Handling**: API failures, network errors, invalid inputs

**Property Test Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with feature name and property number
- Tag format: `Feature: agentguard-landing-page, Property {N}: {property text}`

**Example Property Tests**:
```typescript
import fc from 'fast-check';

describe('Property Tests', () => {
  // Feature: agentguard-landing-page, Property 1: Language Tab Switching
  it('switches to correct language for any tab click', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('typescript', 'python'),
        (language) => {
          render(<CodeExample />);
          const tab = screen.getByRole('tab', { name: language });
          fireEvent.click(tab);
          
          const codeBlock = screen.getByTestId('code-block');
          expect(codeBlock).toHaveAttribute('data-language', language);
          expect(tab).toHaveAttribute('aria-selected', 'true');
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: agentguard-landing-page, Property 3: Feature Completeness
  it('all features have required properties', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({
          icon: fc.string(),
          title: fc.string({ minLength: 1 }),
          description: fc.string({ minLength: 1 }),
          category: fc.constantFrom('security', 'cost', 'dx'),
        })),
        (features) => {
          render(<Features features={features} />);
          
          features.forEach((feature) => {
            expect(screen.getByText(feature.title)).toBeInTheDocument();
            expect(screen.getByText(feature.description)).toBeInTheDocument();
            // Verify icon and category are rendered
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: agentguard-landing-page, Property 13: Theme Toggle Functionality
  it('toggles theme from any initial state', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('light', 'dark'),
        (initialTheme) => {
          const { container } = render(
            <ThemeProvider initialTheme={initialTheme}>
              <ThemeToggle />
            </ThemeProvider>
          );
          
          const toggleButton = screen.getByRole('button', { name: /theme/i });
          fireEvent.click(toggleButton);
          
          const expectedTheme = initialTheme === 'light' ? 'dark' : 'light';
          expect(container.firstChild).toHaveClass(expectedTheme);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: agentguard-landing-page, Property 19: Text Contrast Ratios
  it('maintains minimum contrast ratios for all text', () => {
    fc.assert(
      fc.property(
        fc.record({
          textColor: fc.hexaString({ minLength: 6, maxLength: 6 }),
          backgroundColor: fc.hexaString({ minLength: 6, maxLength: 6 }),
          fontSize: fc.integer({ min: 12, max: 48 }),
        }),
        ({ textColor, backgroundColor, fontSize }) => {
          const contrast = calculateContrastRatio(textColor, backgroundColor);
          const isLargeText = fontSize >= 18 || (fontSize >= 14 && isBold);
          const minContrast = isLargeText ? 3 : 4.5;
          
          // Only test if colors are actually used in the design system
          if (isDesignSystemColor(textColor) && isDesignSystemColor(backgroundColor)) {
            expect(contrast).toBeGreaterThanOrEqual(minContrast);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### E2E Testing Strategy

Critical user flows to test with Playwright:

1. **GitHub Conversion Flow**: Hero CTA → GitHub repository
2. **Documentation Flow**: View Docs CTA → Documentation site
3. **Code Copy Flow**: View code example → Click copy → Verify clipboard
4. **Theme Switching Flow**: Toggle theme → Verify persistence → Reload page
5. **Mobile Navigation Flow**: Open mobile menu → Navigate to section
6. **Metrics Loading Flow**: Load page → Verify metrics display → Verify fallback on error

**Example E2E Test**:
```typescript
import { test, expect } from '@playwright/test';

test('GitHub conversion flow', async ({ page }) => {
  await page.goto('/');
  
  // Click "Get Started" CTA
  await page.click('text=Get Started');
  
  // Verify navigation to GitHub
  await expect(page).toHaveURL(/github\.com/);
});

test('code copy flow', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  
  // Scroll to code example
  await page.locator('[data-testid="code-example"]').scrollIntoViewIfNeeded();
  
  // Click copy button
  await page.click('[data-testid="copy-button"]');
  
  // Verify clipboard content
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText).toContain('import');
  
  // Verify visual feedback
  await expect(page.locator('[data-testid="copy-success"]')).toBeVisible();
});
```

### Accessibility Testing

Automated accessibility tests using jest-axe:

```typescript
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

describe('Accessibility', () => {
  it('has no accessibility violations on hero section', async () => {
    const { container } = render(<Hero />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no accessibility violations in dark mode', async () => {
    const { container } = render(
      <ThemeProvider initialTheme="dark">
        <LandingPage />
      </ThemeProvider>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

### Performance Testing

Performance tests using Lighthouse CI:

```yaml
# lighthouserc.json
{
  "ci": {
    "collect": {
      "numberOfRuns": 3,
      "url": ["http://localhost:3000"]
    },
    "assert": {
      "assertions": {
        "first-contentful-paint": ["error", { "maxNumericValue": 2000 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "total-blocking-time": ["error", { "maxNumericValue": 300 }]
      }
    }
  }
}
```

### Test Coverage Goals

- **Unit Test Coverage**: 80%+ for components and utilities
- **Property Test Coverage**: All 27 correctness properties implemented
- **E2E Test Coverage**: 6 critical user flows
- **Accessibility**: Zero axe violations
- **Performance**: All Lighthouse metrics in "good" range

### Continuous Integration

Tests run on every commit:
1. Unit tests (Vitest)
2. Property tests (fast-check via Vitest)
3. Accessibility tests (jest-axe)
4. E2E tests (Playwright) - on main branch only
5. Performance tests (Lighthouse CI) - on main branch only

