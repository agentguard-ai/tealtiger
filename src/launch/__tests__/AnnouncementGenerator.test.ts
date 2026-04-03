/**
 * Unit tests for AnnouncementGenerator
 *
 * Tests multi-platform announcement generation including release highlights,
 * installation instructions, documentation links, and migration guidance
 * for GitHub, Dev.to, Twitter, LinkedIn, and Reddit.
 */

import {
  AnnouncementGenerator,
  ANNOUNCEMENT_PLATFORMS,
  type AnnouncementPlatform,
} from '../AnnouncementGenerator';

// ── Helpers ───────────────────────────────────────────────────────

function createGenerator(opts?: { docsBaseUrl?: string; layersBaseUrl?: string }) {
  return new AnnouncementGenerator(opts);
}

// ── Tests ─────────────────────────────────────────────────────────

describe('AnnouncementGenerator', () => {
  const VERSION = '1.1.0';

  // ── generateAllAnnouncements ────────────────────────────────────

  describe('generateAllAnnouncements', () => {
    it('should generate an announcement for every platform', () => {
      const gen = createGenerator();
      const announcements = gen.generateAllAnnouncements(VERSION);
      const platforms = announcements.map((a) => a.platform);

      for (const p of ANNOUNCEMENT_PLATFORMS) {
        expect(platforms).toContain(p);
      }
    });

    it('should generate exactly 5 announcements', () => {
      const gen = createGenerator();
      const announcements = gen.generateAllAnnouncements(VERSION);
      expect(announcements).toHaveLength(5);
    });

    it('should reject invalid version format', () => {
      const gen = createGenerator();
      expect(() => gen.generateAllAnnouncements('bad')).toThrow('Invalid version format');
    });
  });

  // ── generateAnnouncement ────────────────────────────────────────

  describe('generateAnnouncement', () => {
    it('should reject invalid version format', () => {
      const gen = createGenerator();
      expect(() => gen.generateAnnouncement('nope', 'github')).toThrow(
        'Invalid version format',
      );
    });

    it.each(ANNOUNCEMENT_PLATFORMS)(
      'should return a non-empty title and content for %s',
      (platform) => {
        const gen = createGenerator();
        const a = gen.generateAnnouncement(VERSION, platform);
        expect(a.title.length).toBeGreaterThan(0);
        expect(a.content.length).toBeGreaterThan(0);
        expect(a.tags.length).toBeGreaterThan(0);
      },
    );
  });

  // ── Content requirements (Req 11.2–11.5) ────────────────────────

  describe('announcement content', () => {
    // Every non-twitter platform should include all four content blocks
    const fullPlatforms: AnnouncementPlatform[] = ['github', 'devto', 'linkedin', 'reddit'];

    it.each(fullPlatforms)(
      '%s should include release highlights',
      (platform) => {
        const gen = createGenerator();
        const a = gen.generateAnnouncement(VERSION, platform);
        expect(a.content).toContain('7 LLM Providers');
        expect(a.content).toContain('95%+ Market Coverage');
        expect(a.content).toContain('12+ Distribution Channels');
      },
    );

    it.each(fullPlatforms)(
      '%s should include installation instructions',
      (platform) => {
        const gen = createGenerator();
        const a = gen.generateAnnouncement(VERSION, platform);
        expect(a.content).toContain(`npm install tealtiger@${VERSION}`);
        expect(a.content).toContain(`pip install tealtiger==${VERSION}`);
      },
    );

    it.each(fullPlatforms)(
      '%s should include documentation links',
      (platform) => {
        const gen = createGenerator();
        const a = gen.generateAnnouncement(VERSION, platform);
        expect(a.content).toContain('https://docs.tealtiger.ai');
        expect(a.content).toContain('https://github.com/tealtiger/tealtiger');
      },
    );

    it.each(fullPlatforms)(
      '%s should include migration guidance',
      (platform) => {
        const gen = createGenerator();
        const a = gen.generateAnnouncement(VERSION, platform);
        expect(a.content).toContain('Migrating from v1.0.x');
        expect(a.content).toContain('No breaking API changes');
      },
    );
  });

  // ── Platform-specific tests ─────────────────────────────────────

  describe('GitHub release', () => {
    it('should use markdown formatting', () => {
      const gen = createGenerator();
      const a = gen.generateAnnouncement(VERSION, 'github');
      expect(a.title).toBe(`TealTiger v${VERSION}`);
      expect(a.content).toContain('## Release Highlights');
      expect(a.content).toContain('## Installation');
      expect(a.content).toContain('## Documentation');
      expect(a.content).toContain('## Migrating from v1.0.x');
    });
  });

  describe('Dev.to blog post', () => {
    it('should include frontmatter', () => {
      const gen = createGenerator();
      const a = gen.generateAnnouncement(VERSION, 'devto');
      expect(a.content).toContain('---');
      expect(a.content).toContain('title:');
      expect(a.content).toContain('published: false');
      expect(a.content).toContain('tags:');
    });
  });

  describe('Twitter', () => {
    it('should be at most 280 characters', () => {
      const gen = createGenerator();
      const a = gen.generateAnnouncement(VERSION, 'twitter');
      expect(a.content.length).toBeLessThanOrEqual(280);
    });

    it('should mention key highlights', () => {
      const gen = createGenerator();
      const a = gen.generateAnnouncement(VERSION, 'twitter');
      expect(a.content).toContain('7 LLM providers');
      expect(a.content).toContain('95%+');
    });
  });

  describe('LinkedIn', () => {
    it('should include professional hashtags', () => {
      const gen = createGenerator();
      const a = gen.generateAnnouncement(VERSION, 'linkedin');
      expect(a.content).toContain('#TealTiger');
      expect(a.content).toContain('#AISecurity');
    });
  });

  describe('Reddit', () => {
    it('should use bold markdown for the title line', () => {
      const gen = createGenerator();
      const a = gen.generateAnnouncement(VERSION, 'reddit');
      expect(a.content).toContain(`**TealTiger v${VERSION}**`);
    });
  });

  // ── Custom options ──────────────────────────────────────────────

  describe('custom options', () => {
    it('should use custom docsBaseUrl in documentation links', () => {
      const gen = createGenerator({ docsBaseUrl: 'https://custom.docs.example' });
      const a = gen.generateAnnouncement(VERSION, 'github');
      expect(a.content).toContain('https://custom.docs.example');
    });

    it('should use custom layersBaseUrl in documentation links', () => {
      const gen = createGenerator({ layersBaseUrl: 'https://custom.layers.example' });
      const a = gen.generateAnnouncement(VERSION, 'github');
      expect(a.content).toContain('https://custom.layers.example');
    });
  });
});
