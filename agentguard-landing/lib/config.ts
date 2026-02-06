/**
 * Site Configuration
 * 
 * Central configuration for all content, links, and metadata for the TealTiger landing page.
 */

export const siteConfig = {
  // Site Metadata
  name: 'TealTiger',
  tagline: 'Powerful protection for AI agents',
  description: 'Open-source security and cost tracking for AI applications. Drop-in SDK for OpenAI, Anthropic, and Azure OpenAI with built-in guardrails and budget management.',
  url: 'https://tealtiger.co.in',
  ogImage: '/og-image.png',
  
  // External Links
  links: {
    github: 'https://github.com/agentguard-ai/tealtiger',
    npm: 'https://www.npmjs.com/package/tealtiger',
    pypi: 'https://pypi.org/project/tealtiger/',
    docs: 'https://github.com/agentguard-ai/tealtiger#readme',
    discord: '', // Optional - leave empty if not available
    twitter: '', // Optional - leave empty if not available
    linkedin: 'https://www.linkedin.com/company/agentguard-ai',
  },

  // Hero Section
  hero: {
    headline: 'Powerful protection for AI agents',
    subheadline: 'Open-source SDK that adds security guardrails and cost tracking to your AI applications in minutes. Drop-in replacement for OpenAI, Anthropic, and Azure OpenAI clients.',
    cta: {
      primary: {
        text: 'Get Started',
        href: 'https://github.com/agentguard-ai/tealtiger#quick-start',
      },
      secondary: {
        text: 'View on GitHub',
        href: 'https://github.com/agentguard-ai/tealtiger',
      },
    },
  },

  // Problem Section
  problem: {
    title: 'AI Applications Have Critical Gaps',
    description: 'Building AI applications is easy. Securing them and controlling costs? Not so much.',
    problems: [
      {
        title: 'Security Risks',
        description: 'PII leaks, prompt injections, and toxic content slip through without proper guardrails.',
        icon: 'shield-alert',
      },
      {
        title: 'Cost Overruns',
        description: 'AI costs can spike unexpectedly. A single bug or attack can drain your budget in minutes.',
        icon: 'trending-up',
      },
      {
        title: 'Disconnected Tools',
        description: 'Security and cost tracking require separate tools, complex integrations, and constant maintenance.',
        icon: 'unplug',
      },
    ],
    story: {
      enabled: true,
      text: 'One developer learned this the hard way: a production bug caused their AI agent to loop infinitely, racking up $10,000 in OpenAI charges overnight. No alerts. No safeguards. Just a massive bill.',
    },
  },

  // Solution Section
  solution: {
    title: 'One SDK. Complete Protection.',
    description: 'TealTiger wraps your AI client with security guardrails and cost controls. No architecture changes. No separate tools.',
    features: [
      {
        title: 'Drop-in Integration',
        description: 'Replace your OpenAI/Anthropic client with TealOpenAI/TealAnthropic. That\'s it.',
      },
      {
        title: 'Built-in Guardrails',
        description: 'PII detection, prompt injection prevention, content moderation - all included.',
      },
    ],
    clients: ['OpenAI', 'Anthropic', 'Azure OpenAI'],
    guardrails: ['PII Detection', 'Prompt Injection', 'Content Moderation', 'Toxic Language'],
    openSource: true,
  },
} as const;

export type SiteConfig = typeof siteConfig;
