/**
 * Trace Analyzer - Program Analysis for Agent Execution Traces
 * 
 * Inspired by AgentArmor research: converts agent traces into analyzable
 * program structures to detect prompt injection and other security anomalies
 */

class TraceAnalyzer {
  constructor() {
    this.injectionPatterns = this.loadInjectionPatterns();
    this.anomalyThreshold = 0.75; // Based on AgentArmor's 95.75% TPR
    this.analysisCache = new Map();
  }

  /**
   * Analyze complete execution trace for security anomalies
   */
  async analyzeExecutionTrace(trace) {
    try {
      console.log(`🔍 Analyzing execution trace: ${trace.requestId}`);
      
      // Step 1: Build graph representations
      const graphs = await this.buildGraphRepresentations(trace);
      
      // Step 2: Detect prompt injection patterns
      const injectionAnalysis = await this.detectPromptInjection(graphs, trace);
      
      // Step 3: Analyze control flow anomalies
      const controlFlowAnalysis = await this.analyzeControlFlow(graphs.cfg);
      
      // Step 4: Track sensitive data flow
      const dataFlowAnalysis = await this.analyzeSensitiveDataFlow(graphs.dfg, trace);
      
      // Step 5: Combine analyses for final assessment
      const overallRisk = this.combineAnalyses({
        injection: injectionAnalysis,
        controlFlow: controlFlowAnalysis,
        dataFlow: dataFlowAnalysis
      });
      
      const result = {
        requestId: trace.requestId,
        timestamp: new Date().toISOString(),
        overallRisk: overallRisk.level,
        confidence: overallRisk.confidence,
        analyses: {
          promptInjection: injectionAnalysis,
          controlFlow: controlFlowAnalysis,
          dataFlow: dataFlowAnalysis
        },
        recommendations: overallRisk.recommendations,
        graphMetrics: this.calculateGraphMetrics(graphs)
      };
      
      // Cache result for learning
      this.analysisCache.set(trace.requestId, result);
      
      console.log(`✅ Trace analysis complete: ${overallRisk.level} risk`);
      return result;
      
    } catch (error) {
      console.error('Trace analysis error:', error);
      return {
        requestId: trace.requestId,
        error: error.message,
        overallRisk: 'unknown',
        confidence: 0
      };
    }
  }

  /**
   * Build graph representations (CFG, DFG, PDG) from execution trace
   */
  async buildGraphRepresentations(trace) {
    const nodes = this.extractNodes(trace);
    const edges = this.extractEdges(trace);
    
    return {
      cfg: this.buildControlFlowGraph(nodes, edges),
      dfg: this.buildDataFlowGraph(nodes, edges, trace),
      pdg: this.buildProgramDependencyGraph(nodes, edges)
    };
  }

  /**
   * Extract nodes from execution trace
   */
  extractNodes(trace) {
    const nodes = [];
    let nodeId = 0;
    
    // Add initial request node
    nodes.push({
      id: nodeId++,
      type: 'request',
      toolName: trace.toolName,
      parameters: trace.parameters,
      timestamp: trace.timestamp
    });
    
    // Add execution steps
    if (trace.executionSteps) {
      trace.executionSteps.forEach(step => {
        nodes.push({
          id: nodeId++,
          type: 'execution',
          action: step.action,
          input: step.input,
          output: step.output,
          timestamp: step.timestamp
        });
      });
    }
    
    // Add decision node
    nodes.push({
      id: nodeId++,
      type: 'decision',
      action: trace.decision?.action,
      reason: trace.decision?.reason,
      timestamp: trace.decision?.timestamp
    });
    
    return nodes;
  }

  /**
   * Extract edges (relationships) from execution trace
   */
  extractEdges(trace) {
    const edges = [];
    const nodes = this.extractNodes(trace);
    
    // Create sequential control flow edges
    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({
        from: nodes[i].id,
        to: nodes[i + 1].id,
        type: 'control-flow',
        weight: 1
      });
    }
    
    // Add data flow edges
    this.addDataFlowEdges(edges, nodes, trace);
    
    return edges;
  }

  /**
   * Build Control Flow Graph (CFG)
   */
  buildControlFlowGraph(nodes, edges) {
    const controlEdges = edges.filter(e => e.type === 'control-flow');
    
    return {
      nodes: nodes,
      edges: controlEdges,
      entryPoint: nodes[0]?.id,
      exitPoint: nodes[nodes.length - 1]?.id,
      metrics: {
        nodeCount: nodes.length,
        edgeCount: controlEdges.length,
        complexity: this.calculateCyclomaticComplexity(nodes, controlEdges)
      }
    };
  }

  /**
   * Build Data Flow Graph (DFG)
   */
  buildDataFlowGraph(nodes, edges, trace) {
    const dataEdges = edges.filter(e => e.type === 'data-flow');
    
    // Track data dependencies
    const dataDependencies = this.trackDataDependencies(trace);
    
    return {
      nodes: nodes,
      edges: dataEdges,
      dependencies: dataDependencies,
      sensitiveData: this.identifySensitiveData(trace),
      metrics: {
        dataFlowPaths: dataEdges.length,
        sensitiveDataNodes: dataDependencies.sensitive?.length || 0
      }
    };
  }

  /**
   * Detect prompt injection patterns using program analysis
   */
  async detectPromptInjection(graphs, trace) {
    const indicators = [];
    let riskScore = 0;
    
    // Pattern 1: Unexpected control flow changes
    const controlFlowAnomalies = this.detectControlFlowAnomalies(graphs.cfg);
    if (controlFlowAnomalies.length > 0) {
      indicators.push({
        type: 'control-flow-anomaly',
        severity: 'medium',
        details: controlFlowAnomalies
      });
      riskScore += 0.3;
    }
    
    // Pattern 2: Suspicious data flow patterns
    const suspiciousDataFlow = this.detectSuspiciousDataFlow(graphs.dfg);
    if (suspiciousDataFlow.length > 0) {
      indicators.push({
        type: 'suspicious-data-flow',
        severity: 'high',
        details: suspiciousDataFlow
      });
      riskScore += 0.5;
    }
    
    // Pattern 3: Input manipulation patterns
    const inputManipulation = this.detectInputManipulation(trace);
    if (inputManipulation.detected) {
      indicators.push({
        type: 'input-manipulation',
        severity: 'critical',
        details: inputManipulation.patterns
      });
      riskScore += 0.7;
    }
    
    // Pattern 4: Trust boundary violations
    const trustViolations = this.detectTrustBoundaryViolations(graphs.pdg);
    if (trustViolations.length > 0) {
      indicators.push({
        type: 'trust-boundary-violation',
        severity: 'high',
        details: trustViolations
      });
      riskScore += 0.6;
    }
    
    const riskLevel = this.calculateRiskLevel(riskScore);
    
    return {
      detected: riskScore > this.anomalyThreshold,
      riskScore: riskScore,
      riskLevel: riskLevel,
      indicators: indicators,
      confidence: Math.min(riskScore * 1.2, 1.0), // Boost confidence slightly
      patterns: this.identifySpecificPatterns(indicators)
    };
  }

  /**
   * Detect control flow anomalies
   */
  detectControlFlowAnomalies(cfg) {
    const anomalies = [];
    
    // Check for unexpected branches
    const unexpectedBranches = this.findUnexpectedBranches(cfg);
    if (unexpectedBranches.length > 0) {
      anomalies.push({
        type: 'unexpected-branches',
        count: unexpectedBranches.length,
        branches: unexpectedBranches
      });
    }
    
    // Check for cyclic patterns (potential loops)
    const cycles = this.detectCycles(cfg);
    if (cycles.length > 0) {
      anomalies.push({
        type: 'unexpected-cycles',
        count: cycles.length,
        cycles: cycles
      });
    }
    
    return anomalies;
  }

  /**
   * Detect suspicious data flow patterns
   */
  detectSuspiciousDataFlow(dfg) {
    const suspicious = [];
    
    // Check for data exfiltration patterns
    const exfiltrationPaths = this.findDataExfiltrationPaths(dfg);
    if (exfiltrationPaths.length > 0) {
      suspicious.push({
        type: 'data-exfiltration',
        paths: exfiltrationPaths
      });
    }
    
    // Check for sensitive data leakage
    const leakagePaths = this.findSensitiveDataLeakage(dfg);
    if (leakagePaths.length > 0) {
      suspicious.push({
        type: 'sensitive-data-leakage',
        paths: leakagePaths
      });
    }
    
    return suspicious;
  }

  /**
   * Detect input manipulation patterns
   */
  detectInputManipulation(trace) {
    const patterns = [];
    
    // Check for prompt injection keywords
    const injectionKeywords = this.checkForInjectionKeywords(trace);
    if (injectionKeywords.found) {
      patterns.push({
        type: 'injection-keywords',
        keywords: injectionKeywords.keywords,
        locations: injectionKeywords.locations
      });
    }
    
    // Check for encoding/obfuscation attempts
    const obfuscation = this.detectObfuscation(trace);
    if (obfuscation.detected) {
      patterns.push({
        type: 'obfuscation',
        techniques: obfuscation.techniques
      });
    }
    
    return {
      detected: patterns.length > 0,
      patterns: patterns
    };
  }

  /**
   * Check for prompt injection keywords
   */
  checkForInjectionKeywords(trace) {
    const injectionKeywords = [
      'ignore previous instructions',
      'forget everything above',
      'new instructions:',
      'system prompt:',
      'override security',
      'bypass restrictions',
      'admin mode',
      'developer mode',
      'jailbreak',
      'prompt injection'
    ];
    
    const found = [];
    const locations = [];
    
    const searchText = JSON.stringify(trace).toLowerCase();
    
    injectionKeywords.forEach(keyword => {
      if (searchText.includes(keyword.toLowerCase())) {
        found.push(keyword);
        // Find specific locations
        const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const matches = [...searchText.matchAll(regex)];
        locations.push(...matches.map(m => ({ keyword, position: m.index })));
      }
    });
    
    return {
      found: found.length > 0,
      keywords: found,
      locations: locations
    };
  }

  /**
   * Calculate overall risk level
   */
  calculateRiskLevel(riskScore) {
    if (riskScore >= 0.8) return 'critical';
    if (riskScore >= 0.6) return 'high';
    if (riskScore >= 0.4) return 'medium';
    if (riskScore >= 0.2) return 'low';
    return 'minimal';
  }

  /**
   * Combine multiple analyses into overall assessment
   */
  combineAnalyses(analyses) {
    let totalRisk = 0;
    let totalConfidence = 0;
    let count = 0;
    
    const recommendations = [];
    
    // Weight different analysis types
    const weights = {
      injection: 0.5,    // Highest weight - primary concern
      controlFlow: 0.3,  // Medium weight - structural anomalies
      dataFlow: 0.2      // Lower weight - data patterns
    };
    
    Object.entries(analyses).forEach(([type, analysis]) => {
      if (analysis && typeof analysis.riskScore === 'number') {
        totalRisk += analysis.riskScore * weights[type];
        totalConfidence += (analysis.confidence || 0.5) * weights[type];
        count++;
        
        if (analysis.riskScore > 0.5) {
          recommendations.push(`Address ${type} issues: ${analysis.riskLevel} risk detected`);
        }
      }
    });
    
    const overallRisk = Math.min(totalRisk, 1.0);
    const overallConfidence = Math.min(totalConfidence, 1.0);
    
    return {
      level: this.calculateRiskLevel(overallRisk),
      score: overallRisk,
      confidence: overallConfidence,
      recommendations: recommendations
    };
  }

  /**
   * Load known injection patterns (can be enhanced with ML)
   */
  loadInjectionPatterns() {
    return {
      keywords: [
        'ignore previous instructions',
        'forget everything above',
        'new instructions:',
        'system prompt:',
        'override security'
      ],
      patterns: [
        /ignore\s+previous\s+instructions/i,
        /forget\s+everything\s+above/i,
        /new\s+instructions\s*:/i,
        /system\s+prompt\s*:/i
      ]
    };
  }

  /**
   * Helper methods for graph analysis
   */
  addDataFlowEdges(edges, nodes, trace) {
    // Simple data flow tracking - can be enhanced
    for (let i = 0; i < nodes.length - 1; i++) {
      const currentNode = nodes[i];
      const nextNode = nodes[i + 1];
      
      // If output of current becomes input of next
      if (currentNode.output && nextNode.input) {
        edges.push({
          from: currentNode.id,
          to: nextNode.id,
          type: 'data-flow',
          data: currentNode.output
        });
      }
    }
  }

  trackDataDependencies(trace) {
    // Track how data flows through the execution
    const dependencies = {
      userInput: [],
      systemOutput: [],
      sensitive: []
    };
    
    // Identify user input sources
    if (trace.parameters) {
      Object.keys(trace.parameters).forEach(key => {
        dependencies.userInput.push({
          source: 'parameters',
          key: key,
          value: trace.parameters[key]
        });
      });
    }
    
    return dependencies;
  }

  identifySensitiveData(trace) {
    const sensitivePatterns = [
      /password/i,
      /token/i,
      /secret/i,
      /key/i,
      /credential/i,
      /api[_-]?key/i
    ];
    
    const sensitiveData = [];
    const traceStr = JSON.stringify(trace);
    
    sensitivePatterns.forEach(pattern => {
      if (pattern.test(traceStr)) {
        sensitiveData.push({
          pattern: pattern.source,
          detected: true
        });
      }
    });
    
    return sensitiveData;
  }

  calculateCyclomaticComplexity(nodes, edges) {
    // Simple complexity calculation: edges - nodes + 2
    return Math.max(edges.length - nodes.length + 2, 1);
  }

  calculateGraphMetrics(graphs) {
    return {
      cfg: graphs.cfg.metrics,
      dfg: graphs.dfg.metrics,
      totalNodes: graphs.cfg.nodes.length,
      totalEdges: graphs.cfg.edges.length + graphs.dfg.edges.length
    };
  }

  // Placeholder methods for advanced analysis (to be implemented)
  findUnexpectedBranches(cfg) { return []; }
  detectCycles(cfg) { return []; }
  findDataExfiltrationPaths(dfg) { return []; }
  findSensitiveDataLeakage(dfg) { return []; }
  detectObfuscation(trace) { return { detected: false, techniques: [] }; }
  detectTrustBoundaryViolations(pdg) { return []; }
  identifySpecificPatterns(indicators) { return []; }
  buildProgramDependencyGraph(nodes, edges) { return { nodes, edges }; }
}

// Export singleton instance
module.exports = new TraceAnalyzer();