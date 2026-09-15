from tealtiger_croissant import CroissantGovernanceEnforcer


metadata = {
    "@id": "restricted-health-data",
    "usageInfo": {
        "@type": ["CreativeWork", "odrl:Offer"],
        "odrl:permission": {
            "@type": "odrl:Permission",
            "odrl:action": {"@id": "duo:0000006"},
            "odrl:constraint": {
                "@type": "odrl:Constraint",
                "odrl:operator": {"@id": "odrl:eq"},
                "odrl:rightOperand": {"@id": "duo:0000018"},
            },
        },
    },
}

decision = CroissantGovernanceEnforcer().evaluate_access(
    metadata,
    {
        "purpose": "research",
        "research_area": "medical",
        "org_type": "commercial",
    },
)

print(decision.action)
print(decision.reason_codes)

