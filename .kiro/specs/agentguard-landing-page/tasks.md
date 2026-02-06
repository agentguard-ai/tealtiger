# Implementation Plan: AgentGuard Landing Page

## Overview

This implementation plan breaks down the AgentGuard landing page into discrete, incremental coding tasks. The approach follows a bottom-up strategy: build foundational components first, then compose them into sections, and finally integrate everything into the complete landing page. Each task builds on previous work, ensuring no orphaned code.

The implementation uses Next.js 14 (App Router), TypeScript, and Tailwind CSS, deployed on Vercel. Testing includes both unit tests and property-based tests to ensure correctness.

## Tasks

- [x] 1. Project setup and configuration
  - Initialize Next.js 14 project with TypeScript and App Router
  - Configure Tailwind CSS with custom design tokens
  - Set up project structure (components, lib, public directories)
  - Configure ESLint, Prettier, and TypeScript strict mode
  - Install dependencies: Lucide React (icons), Shiki (syntax highlighting), fast-check (property testing)
  - Create base configuration file (`lib/config.ts`) with site metadata
  - _Requirements: 17.1, 17.2_

- [x] 2. Design system and UI components
  - [x] 2.1 Create Button component with variants
    - Implement Button component with primary, secondary, outline, and ghost variants
    - Add size variants (sm, md, lg)
    - Include hover, focus, and disabled states
    - Support both link and button functionality
    - _Requirements: 1.3, 8.2_
  
  - [x] 2.2 Write unit tests for Button component
    - Test all variant combinations
    - Test accessibility (focus indicators, ARIA labels)
    - Test keyboard navigation
    - _Requirements: 13.2_
  
  - [x] 2.3 Create Card component
    - Implement Card with default, bordered, and elevated variants
    - Add padding size options
    - Support custom className for flexibility
    - _Requirements: 5.1_
  
  - [x] 2.4 Create Tabs component
    - Implement accessible tabs with keyboard navigation
    - Add active tab indicator
    - Support controlled and uncontrolled modes
    - Include ARIA roles and labels
    - _Requirements: 4.3, 13.3_
  
  - [x] 2.5 Write property test for Tabs component
    - **Property 1: Language Tab Switching**
    - **Validates: Requirements 4.4**
  
  - [x] 2.6 Create CodeBlock component
    - Integrate Shiki for syntax highlighting
    - Add copy-to-clipboard functionality
    - Implement copy success feedback
    - Support line numbers and filename display
    - Make theme-aware (light/dark mode)
    - _Requirements: 4.1, 4.5, 4.6, 4.7_
  
  - [x] 2.7 Write property test for CodeBlock copy functionality
    - **Property 2: Code Copy with Feedback**
    - **Validates: Requirements 4.6, 4.7**

- [x] 3. Theme system implementation
  - [x] 3.1 Create ThemeProvider component
    - Implement theme context with light/dark modes
    - Detect system color scheme preference
    - Add theme toggle functionality
    - Persist theme preference in localStorage
    - Prevent flash of unstyled content (FOUC)
    - _Requirements: 11.1, 11.4, 11.5_
  
  - [x] 3.2 Write property tests for theme system
    - **Property 10: Dark Mode System Preference**
    - **Property 13: Theme Toggle Functionality**
    - **Property 14: Theme Persistence**
    - **Validates: Requirements 11.1, 11.4, 11.5**
  
  - [x] 3.3 Configure Tailwind dark mode
    - Set up CSS custom properties for colors
    - Define light and dark mode color palettes
    - Ensure WCAG AA contrast ratios
    - _Requirements: 11.2, 13.4_
  
  - [x] 3.4 Write property test for dark mode contrast
    - **Property 11: Dark Mode Contrast**
    - **Validates: Requirements 11.2**

- [ ] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Content configuration
  - [x] 5.1 Create site configuration
    - Define site metadata (name, description, URL, OG image)
    - Add all external links (GitHub, docs, Discord, social media)
    - Create hero section configuration
    - Create problem section configuration
    - Create solution section configuration
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1_
  
  - [x] 5.2 Create code examples configuration
    - Define TypeScript code examples (before/after)
    - Define Python code examples (before/after)
    - Store as strings in configuration
    - _Requirements: 4.1, 4.2_
  
  - [x] 5.3 Create features configuration
    - Define 6 key features with icons, titles, descriptions
    - Assign categories (security, cost, dx)
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  
  - [x] 5.4 Write property test for feature completeness
    - **Property 3: Feature Completeness**
    - **Validates: Requirements 5.2, 5.3, 5.4**
  
  - [x] 5.5 Create comparison and CTA configuration
    - Define comparison table data
    - Define CTA section content
    - Define footer links and legal information
    - _Requirements: 7.1, 8.1, 8.2, 9.1, 9.2, 9.3, 9.4_

- [x] 6. API integration for metrics
  - [x] 6.1 Create metrics utility functions
    - Implement fetchGitHubStars function
    - Implement fetchNpmDownloads function
    - Implement fetchPyPiDownloads function (with fallback)
    - Add error handling and retry logic
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [x] 6.2 Create API route for metrics
    - Implement `/api/metrics` route with ISR (revalidate every 3600s)
    - Fetch all metrics in parallel
    - Return structured MetricsData response
    - Handle API failures gracefully
    - _Requirements: 6.4, 6.5_
  
  - [x] 6.3 Write property tests for metrics API
    - **Property 4: API Metrics Fetching**
    - **Property 5: API Failure Fallback**
    - **Validates: Requirements 6.4, 6.5**

- [x] 7. Section components implementation
  - [x] 7.1 Create Hero section component
    - Implement two-column layout (text + visual)
    - Add headline with gradient text effect
    - Add subheadline and CTA buttons
    - Make responsive (stack on mobile)
    - Add hero visual (SVG or optimized image)
    - _Requirements: 1.1, 1.2, 1.3, 1.7, 10.1_
  
  - [x] 7.2 Write unit tests for Hero section
    - Test headline and subheadline display
    - Test CTA button rendering and links
    - Test responsive layout
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_
  
  - [x] 7.3 Create Problem section component
    - Implement centered title and description
    - Add three-column grid for problems (security, cost, connection)
    - Include optional story callout box
    - Make responsive (single column on mobile)
    - _Requirements: 2.1, 2.2, 2.3, 10.1_
  
  - [x] 7.4 Create Solution section component
    - Implement centered title and description
    - Add two-column grid for features
    - Display supported clients and guardrails
    - Emphasize "100% open source"
    - Make responsive
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 10.1_
  
  - [x] 7.5 Create CodeExample section component
    - Integrate Tabs component for language switching
    - Display before/after code comparison
    - Use CodeBlock component for syntax highlighting
    - Add copy buttons to each code block
    - Make responsive (stack on mobile)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 10.1_
  
  - [x] 7.6 Write property test for syntax highlighting
    - **Property 12: Dark Mode Syntax Highlighting**
    - **Validates: Requirements 11.3**

- [ ] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Features and social proof sections
  - [x] 9.1 Create Features section component
    - Implement 3-column grid (responsive to 2-col, 1-col)
    - Display exactly 6 features from configuration
    - Render icon, title, and description for each feature
    - Apply category-based icon colors
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 10.1_
  
  - [x] 9.2 Create SocialProof section component
    - Implement three-column metric display
    - Fetch metrics from `/api/metrics` on mount
    - Display loading skeleton while fetching
    - Show GitHub stars, npm downloads, PyPI downloads
    - Add count-up animation on scroll into view
    - Handle API failures with fallback values
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 10.1_
  
  - [ ] 9.3 Write property test for conditional testimonial rendering
    - **Property 6: Conditional Testimonial Rendering**
    - **Validates: Requirements 6.6**
  
  - [ ] 9.4 Add testimonials carousel (optional)
    - Implement testimonials display if data exists
    - Add auto-rotate functionality (5 seconds)
    - Add manual navigation arrows
    - Make responsive
    - _Requirements: 6.6, 10.1_

- [ ] 10. Comparison, CTA, and Footer sections
  - [x] 10.1 Create Comparison section component
    - Implement table layout for desktop
    - Use card-based layout for mobile
    - Display AgentGuard vs manual implementation
    - Highlight AgentGuard column
    - Use icons for boolean values
    - _Requirements: 7.1, 10.1_
  
  - [x] 10.2 Create CTA section component
    - Implement full-width section with gradient background
    - Display headline and description
    - Add CTA buttons (GitHub, docs, community)
    - Make responsive
    - _Requirements: 8.1, 8.2, 8.3, 10.1_
  
  - [x] 10.3 Write property tests for CTA section
    - **Property 7: CTA Link Navigation**
    - **Property 8: Conditional Community Link Display**
    - **Validates: Requirements 8.3, 8.4**
  
  - [x] 10.4 Create Footer component
    - Implement four-column layout (Product, Resources, Social, Legal)
    - Display all footer links from configuration
    - Add social media links with icons
    - Display license and copyright information
    - Make responsive (collapse to 2-col, 1-col)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 10.1_

- [ ] 11. Main page integration
  - [x] 11.1 Create root layout
    - Set up app/layout.tsx with metadata
    - Add SEO metadata (title, description, keywords)
    - Add Open Graph tags
    - Add Twitter Card tags
    - Include structured data (JSON-LD)
    - Wrap with ThemeProvider
    - _Requirements: 14.1, 14.2, 14.3, 14.4_
  
  - [x] 11.2 Create main landing page
    - Compose all section components in app/page.tsx
    - Arrange sections in correct order
    - Add smooth scroll behavior
    - Ensure proper spacing between sections
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 8.1, 9.1_
  
  - [ ] 11.3 Write property test for responsive layout
    - **Property 9: Responsive Layout Adaptation**
    - **Validates: Requirements 10.1**

- [ ] 12. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Accessibility implementation
  - [ ] 13.1 Add keyboard navigation support
    - Ensure all interactive elements are keyboard accessible
    - Add visible focus indicators (2px outline)
    - Implement skip-to-content link
    - Verify logical tab order
    - _Requirements: 13.2_
  
  - [ ] 13.2 Write property tests for accessibility
    - **Property 17: Keyboard Focus Indicators**
    - **Property 18: ARIA Labels for Icon-Only Elements**
    - **Property 19: Text Contrast Ratios**
    - **Property 20: Image Alt Text**
    - **Validates: Requirements 13.2, 13.3, 13.4, 13.5**
  
  - [ ] 13.3 Add semantic HTML and ARIA labels
    - Use proper HTML5 semantic elements (header, nav, main, section, footer)
    - Add ARIA labels for icon-only buttons
    - Implement proper heading hierarchy
    - Add ARIA live regions for dynamic content
    - _Requirements: 13.3, 14.5_
  
  - [ ] 13.4 Write property test for heading hierarchy
    - **Property 21: Heading Hierarchy**
    - **Validates: Requirements 14.5**
  
  - [ ] 13.4 Add alt text to all images
    - Provide descriptive alt text for meaningful images
    - Use empty alt for decorative images
    - _Requirements: 13.5_
  
  - [ ] 13.5 Run accessibility audit
    - Use jest-axe to test for violations
    - Test both light and dark modes
    - Fix any violations found
    - _Requirements: 13.1_

- [ ] 14. Performance optimization
  - [ ] 14.1 Optimize images
    - Use Next.js Image component for all images
    - Convert images to WebP format with fallbacks
    - Add lazy loading for below-the-fold images
    - Set appropriate sizes and srcset
    - Compress images to <100KB each
    - _Requirements: 12.3, 12.4_
  
  - [ ] 14.2 Write property tests for image optimization
    - **Property 15: Image Format Optimization**
    - **Property 16: Image Lazy Loading**
    - **Validates: Requirements 12.3, 12.4**
  
  - [ ] 14.3 Implement code splitting
    - Lazy load Framer Motion (if used)
    - Lazy load syntax highlighter on scroll
    - Use dynamic imports for heavy components
    - _Requirements: 12.5_
  
  - [ ] 14.4 Configure caching headers
    - Set cache headers for static assets (1 year)
    - Set cache headers for pages (1 hour with revalidation)
    - Configure ISR for metrics API route
    - _Requirements: 17.5_
  
  - [ ] 14.5 Write property test for cache headers
    - **Property 27: Static Asset Cache Headers**
    - **Validates: Requirements 17.5**

- [ ] 15. Animation and interactivity
  - [ ] 15.1 Add scroll animations (optional)
    - Implement scroll-triggered animations for sections
    - Use Intersection Observer API
    - Add smooth transitions
    - _Requirements: 15.1_
  
  - [ ] 15.2 Write property tests for animations
    - **Property 22: Scroll Animation Trigger**
    - **Property 23: CTA Button Hover Feedback**
    - **Property 24: Reduced Motion Preference**
    - **Validates: Requirements 15.1, 15.2, 15.4**
  
  - [ ] 15.3 Add hover effects
    - Implement hover states for CTA buttons
    - Add hover effects for feature cards
    - Ensure smooth transitions
    - _Requirements: 15.2_
  
  - [ ] 15.4 Respect reduced motion preference
    - Check prefers-reduced-motion media query
    - Disable animations when preference is set
    - Provide static alternatives
    - _Requirements: 15.4_

- [ ] 16. Analytics integration
  - [ ] 16.1 Set up analytics tracking
    - Integrate Vercel Analytics or Plausible
    - Track page views on load
    - Respect user privacy preferences
    - _Requirements: 16.1, 16.4_
  
  - [ ] 16.2 Add event tracking
    - Track CTA button clicks with labels
    - Track code copy events
    - Track tab switches
    - _Requirements: 16.2, 16.3_
  
  - [ ] 16.3 Write property tests for analytics
    - **Property 25: CTA Click Tracking**
    - **Property 26: Cookie Consent Conditional Display**
    - **Validates: Requirements 16.2, 16.5**
  
  - [ ] 16.4 Add cookie consent banner (if required)
    - Implement consent banner component
    - Display before initializing tracking
    - Persist consent preference
    - _Requirements: 16.5_

- [ ] 17. SEO and metadata finalization
  - [x] 17.1 Create sitemap.xml
    - Generate sitemap with all pages
    - Include lastmod dates
    - Submit to search engines
    - _Requirements: 14.6_
  
  - [x] 17.2 Create robots.txt
    - Allow all crawlers
    - Reference sitemap location
    - _Requirements: 14.7_
  
  - [ ] 17.3 Generate OG image
    - Create 1200x630 Open Graph image
    - Include AgentGuard branding and tagline
    - Optimize for social media sharing
    - _Requirements: 14.3_
  
  - [ ] 17.4 Verify all metadata
    - Test with social media debuggers (Facebook, Twitter, LinkedIn)
    - Verify structured data with Google Rich Results Test
    - Check meta tags in browser dev tools
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

- [ ] 18. Deployment and final testing
  - [x] 18.1 Configure Vercel deployment
    - Connect GitHub repository to Vercel
    - Configure environment variables (if needed)
    - Set up automatic deployments from main branch
    - Enable HTTPS
    - _Requirements: 17.1, 17.2, 17.3_
  
  - [x] 18.2 Run final test suite
    - Run all unit tests
    - Run all property tests (100 iterations each)
    - Run accessibility tests
    - Fix any failing tests
    - _Requirements: All_
  
  - [ ] 18.3 Run E2E tests
    - Test GitHub conversion flow
    - Test documentation flow
    - Test code copy flow
    - Test theme switching flow
    - Test mobile navigation flow
    - Test metrics loading flow
    - _Requirements: 1.4, 1.5, 1.6, 4.6, 11.4, 6.4_
  
  - [ ] 18.4 Run performance audit
    - Run Lighthouse CI
    - Verify FCP < 2s, LCP < 2.5s
    - Verify bundle size < 200KB gzipped
    - Fix any performance issues
    - _Requirements: 12.1, 12.2, 12.5_
  
  - [ ] 18.5 Deploy to production
    - Merge to main branch
    - Verify deployment succeeds
    - Test production URL
    - Verify HTTPS works
    - _Requirements: 17.2_

- [ ] 19. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties (minimum 100 iterations each)
- Unit tests validate specific examples and edge cases
- The implementation follows a bottom-up approach: components → sections → page → optimization
- All code should be production-ready with proper error handling and accessibility
