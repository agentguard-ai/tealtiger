The classic AG2 integration (merged in #2962) uses `register_reply` which is tied to the ConversableAgent architecture. With AG2 Beta becoming the primary framework at v1.0 and classic entering maintenance mode at v0.14, the governance integration needs a native Beta implementation.

AG2 Beta's middleware system is the natural fit — but there's currently no governance middleware available that provides deterministic policy enforcement, cost tracking, or per-agent kill switches for the new `autogen.beta.Agent`.
