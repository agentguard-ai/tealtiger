# LLM Provider Cost Comparison

Last updated: April 2026.

Prices are listed in USD per 1 million tokens for standard pay-as-you-go API usage unless noted otherwise. Batch processing, prompt caching, provisioned throughput, regional uplifts, private deployments, and committed-use discounts can change the effective price. Always confirm current pricing with the provider before production use.

| Provider | Model | Input $/1M tokens | Output $/1M tokens | Context Window |
| --- | --- | ---: | ---: | --- |
| OpenAI | GPT-5.5 | $5.00; $10.00 above 272K input tokens | $30.00; $45.00 above 272K input tokens | 1,050,000 tokens |
| OpenAI | GPT-5.4 | $2.50; $5.00 above 272K input tokens | $15.00; $22.50 above 272K input tokens | 1,050,000 tokens |
| OpenAI | GPT-5.4 mini | $0.75 | $4.50 | 400,000 tokens |
| Anthropic | Claude Opus 4.1 | $15.00 | $75.00 | 200,000 tokens |
| Anthropic | Claude Sonnet 4 | $3.00 | $15.00 | 200,000 tokens standard; 1,000,000-token beta |
| Anthropic | Claude Haiku 3.5 | $0.80 | $4.00 | 200,000 tokens |
| Gemini | Gemini 3 Pro Preview | $2.00 up to 200K prompt tokens; $4.00 above 200K | $12.00 up to 200K prompt tokens; $18.00 above 200K | 1,048,576 input tokens |
| Gemini | Gemini 3 Flash Preview | $0.50 text/image/video; $1.00 audio | $3.00 | 1,048,576 input tokens |
| Gemini | Gemini 2.5 Flash-Lite | $0.10 text/image/video; $0.30 audio | $0.40 | 1,048,576 input tokens |
| Bedrock | Amazon Nova Micro | $0.035 | $0.14 | 128,000 tokens |
| Bedrock | Amazon Nova Lite | $0.06 | $0.24 | 300,000 tokens |
| Bedrock | Amazon Nova Pro | $0.80 | $3.20 | 300,000 tokens |
| Azure OpenAI | GPT-5 Global Standard | $1.25 | $10.00 | 400,000 tokens |
| Azure OpenAI | GPT-5 mini Global Standard | $0.25 | $2.00 | 400,000 tokens |
| Azure OpenAI | GPT-5 nano Global Standard | $0.05 | $0.40 | 400,000 tokens |
| Cohere | Command A | $2.50 | $10.00 | 256,000 tokens |
| Cohere | Command R+ | $2.50 | $10.00 | 128,000 tokens |
| Cohere | Command R7B | $0.0375 | $0.15 | 128,000 tokens |
| Mistral | Mistral Medium 3.5 | $1.50 | $7.50 | 256,000 tokens |
| Mistral | Mistral Large 3 | $0.50 | $1.50 | 256,000 tokens |
| Mistral | Mistral Small 4 | $0.15 | $0.60 | 256,000 tokens |

## Provider Notes

- OpenAI: GPT-5.5 and GPT-5.4 have long-context pricing once prompts exceed 272K input tokens.
- Anthropic: Claude Sonnet 4 has a 1M token context beta with higher long-context rates above 200K input tokens.
- Gemini: Pro-tier models use higher prices for prompts above 200K tokens; output pricing includes thinking tokens where applicable.
- Bedrock: Amazon Nova pricing shown here reflects the Amazon Nova understanding models on Amazon Bedrock. Batch pricing can reduce inference cost.
- Azure OpenAI: prices vary by deployment type, region, and data zone. The table uses common Global Standard pay-as-you-go model rates; verify the exact Azure region and deployment in the Azure pricing calculator.
- Cohere: prices are for generation/chat models. Rerank and embed models use different pricing units.
- Mistral: prices are for text token API usage on the listed model cards.

## Sources

- OpenAI API pricing and model cards: https://openai.com/api/pricing/ and https://developers.openai.com/api/docs/models/
- Anthropic pricing and model comparison: https://docs.anthropic.com/en/docs/about-claude/pricing and https://docs.anthropic.com/en/docs/about-claude/models/all-models
- Gemini API pricing and model limits: https://ai.google.dev/gemini-api/docs/pricing and https://ai.google.dev/gemini-api/docs/models/gemini
- Amazon Bedrock pricing and Amazon Nova model cards: https://aws.amazon.com/bedrock/pricing/, https://aws.amazon.com/blogs/machine-learning/prompting-for-the-best-price-performance/, and https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters.html
- Azure OpenAI pricing and model catalog: https://azure.microsoft.com/en-us/pricing/details/cognitive-services/openai-service/ and https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/models
- Cohere pricing and model cards: https://docs.cohere.com/docs/how-does-cohere-pricing-work, https://docs.cohere.com/docs/command-a, https://docs.cohere.com/docs/command-r, and https://docs.cohere.com/v2/docs/command-r7b
- Mistral pricing and model cards: https://mistral.ai/pricing, https://docs.mistral.ai/models/model-cards/mistral-medium-3-5-26-04, https://docs.mistral.ai/models/model-cards/mistral-large-3-25-12, and https://docs.mistral.ai/models/model-cards/mistral-small-4-0-26-03
