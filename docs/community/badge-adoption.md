# "Governed by TealTiger" Badge

Show users and collaborators that your Haystack pipeline enforces deterministic
governance with TealTiger: cost caps, PII redaction, prompt-injection defence, and
structured audit evidence.

## Quick copy-paste

### Shields.io badge (recommended)

```markdown
[![Governed by TealTiger](https://img.shields.io/badge/Governed%20by-TealTiger-0f766e?style=flat)](https://github.com/agentguard-ai/tealtiger)
```

Renders as:

[![Governed by TealTiger](https://img.shields.io/badge/Governed%20by-TealTiger-0f766e?style=flat)](https://github.com/agentguard-ai/tealtiger)

### SVG badge (self-hosted, no external dependency)

Copy [`assets/badges/governed-by-tealtiger.svg`](../../assets/badges/governed-by-tealtiger.svg)
into your repository and reference it directly:

```markdown
[![Governed by TealTiger](path/to/governed-by-tealtiger.svg)](https://github.com/agentguard-ai/tealtiger)
```

A dark-background variant is available at
[`assets/badges/governed-by-tealtiger-dark.svg`](../../assets/badges/governed-by-tealtiger-dark.svg).

## Where to place it

Add the badge to your `README.md` alongside your existing CI and quality badges,
before the first section heading:

```markdown
[![Governed by TealTiger](https://img.shields.io/badge/Governed%20by-TealTiger-0f766e?style=flat)](https://github.com/agentguard-ai/tealtiger)
```

## Outreach template

Use this message when asking Haystack open-source maintainers to adopt the badge.
Adjust the project name and governance component references as appropriate.

---

**Subject:** Adding a "Governed by TealTiger" badge to {project-name}

Hi {maintainer-name},

I noticed that {project-name} uses Haystack pipelines involving LLM generators.
We recently integrated [TealTiger](https://github.com/agentguard-ai/tealtiger)
to add deterministic governance — cost caps, PII redaction, and prompt-injection
defence — without touching the pipeline's output logic.

If you are interested in adding similar governance to {project-name}, the
`tealtiger-haystack` package is a drop-in Haystack component:

```python
pip install tealtiger-haystack
```

We would also appreciate it if you would add the "Governed by TealTiger" badge
to signal to contributors that the pipeline's security posture is explicit and
auditable:

```markdown
[![Governed by TealTiger](https://img.shields.io/badge/Governed%20by-TealTiger-0f766e?style=flat)](https://github.com/agentguard-ai/tealtiger)
```

Happy to answer any questions or open a draft PR if that is easier.

{your-name}

---

## Badge design

The badge uses TealTiger's brand colour (`#0f766e`) and is sized to align with
standard shields.io badges at 28 px height. The SVG variant includes a subtle
gradient overlay for compatibility with both light and dark GitHub themes.
