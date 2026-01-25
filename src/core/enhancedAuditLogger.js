/**
 * Enhanced Audit Logger - Integrates trace analysis with audit logging
 * 
 * Extends the basic audit logger to include program analysis capabilities
 * inspired by AgentArmor research
 */

const AuditLogger = require('./auditLogger');
const TraceAnalyzer = require('./traceAnalyzer');

class EnhancedAuditLogger extends AuditLogger {
  constructor() {
    super();
    this.traceAnalyzer = TraceAnalyzer;
    this.traceStorage = []; // In-memory trace storage for MVP
    this.analysisResults = new Map(); // Cache analysis results
  }

  /**
   * Log security decision with execution trace analysis
   */
  async logDecisionWithTrace(decision, request, executionTrace = null) {
    try {
      // Step 1: Log traditional audit entry
      await super.logDecision(decision, request);
      
      // Step 2: Create execution trace if not provided
      const trace = executionTrace || this.createExecutionTrace(decision, request);
      
      // Step 3: Perform trace analysis
      const traceAnalysis = await this.analyzeExecutionTrace(trace);
      
      // Step 4: Store enhanced audit record
      const enhancedAuditEntry = {
        id: this.generateAuditId(),
        timestamp: new Date().toISOString(),
        type: 'enhanced_security_decision',
        requestId: decision.requestId,
        agentId: decision.agentId,
        
        // Traditional audit data
        decision: {
          action: decision.action,
          reason: decision.reason,
          riskLevel: decision.riskLevel
        },
        
        // Enhanced trace analysis
        traceAnalysis: {
          overallRisk: traceAnalysis.overallRisk,
          confidence: traceAnalysis.confidence,
          promptInjectionRisk: traceAnalysis.analyses?.promptInjection?.riskLevel || 'unknown',
          anomaliesDetected: this.countAnomalies(traceAnalysis),
          recommendations: traceAnalysis.recommendations || []
        },
        
        // Execution trace metadata
        executionMetrics: {
          traceLength: trace.executionSteps?.length || 0,
          analysisTime: traceAnalysis.analysisTime,
          graphComplexity: traceAnalysis.graphMetrics?.totalNodes || 0
        }
      };
      
      // Store enhanced entry
      this.decisions.push(enhancedAuditEntry);
      await this.writeToFile(enhancedAuditEntry);
      
      // Store trace for future analysis
      this.storeExecutionTrace(trace, traceAnalysis);
      
      console.log(`📝 Enhanced audit logged: ${decision.action} (${traceAnalysis.overallRisk} risk)`);
      
      return enhancedAuditEntry;
      
    } catch (error) {
      console.error('Enhanced audit logging error:', error);
      // Fallback to basic audit logging
      return await super.logDecision(decision, request);
    }
  }

  /**
   * Create execution trace from decision and request
   */
  createExecutionTrace(decision, request) {
    return {
      requestId: decision.requestId,
      agentId: decision.agentId,
      toolName: decision.toolName,
      parameters: request.body?.parameters || {},
      timestamp: decision.timestamp,
      
      // Execution steps (simplified for MVP)
      executionSteps: [
        {
          step: 1,
          action: 'policy_evaluation',
          input: {
            toolName: decision.toolName,
            riskLevel: decision.riskLevel
          },
          output: {
            action: decision.action,
            reason: decision.reason
          },
          timestamp: decision.timestamp
        }
      ],
      
      // Final decision
      decision: {
        action: decision.action,
        reason: decision.reason,
        timestamp: decision.timestamp
      },
      
      // Request context
      context: {
        clientIp: request.ip,
        userAgent: request.get('User-Agent'),
        apiKey: request.headers['x-api-key']?.slice(-8) // Last 8 chars only
      }
    };
  }

  /**
   * Analyze execution trace using TraceAnalyzer
   */
  async analyzeExecutionTrace(trace) {
    const startTime = Date.now();
    
    try {
      const analysis = await this.traceAnalyzer.analyzeExecutionTrace(trace);
      
      // Add timing information
      analysis.analysisTime = Date.now() - startTime;
      
      // Cache the result
      this.analysisResults.set(trace.requestId, analysis);
      
      return analysis;
      
    } catch (error) {
      console.error('Trace analysis failed:', error);
      
      return {
        requestId: trace.requestId,
        overallRisk: 'unknown',
        confidence: 0,
        error: error.message,
        analysisTime: Date.now() - startTime
      };
    }
  }

  /**
   * Store execution trace for future analysis and learning
   */
  storeExecutionTrace(trace, analysis) {
    const traceRecord = {
      id: this.generateTraceId(),
      timestamp: new Date().toISOString(),
      requestId: trace.requestId,
      agentId: trace.agentId,
      trace: trace,
      analysis: analysis,
      
      // Metadata for learning
      metadata: {
        traceLength: trace.executionSteps?.length || 0,
        riskLevel: analysis.overallRisk,
        anomaliesFound: this.countAnomalies(analysis),
        analysisTime: analysis.analysisTime
      }
    };
    
    this.traceStorage.push(traceRecord);
    
    // Prevent memory overflow
    if (this.traceStorage.length > 1000) {
      this.traceStorage = this.traceStorage.slice(-1000);
    }
  }

  /**
   * Get enhanced audit trail with trace analysis
   */
  async getEnhancedAuditTrail(agentId, options = {}) {
    const { limit = 50, includeTraceAnalysis = true } = options;
    
    let filtered = this.decisions.filter(entry => 
      entry.agentId === agentId && 
      (entry.type === 'enhanced_security_decision' || entry.type === 'security_decision')
    );
    
    // Sort by timestamp (newest first)
    filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Apply limit
    const limited = filtered.slice(0, limit);
    
    // Add trace analysis details if requested
    if (includeTraceAnalysis) {
      for (const entry of limited) {
        if (entry.requestId && this.analysisResults.has(entry.requestId)) {
          entry.detailedAnalysis = this.analysisResults.get(entry.requestId);
        }
      }
    }
    
    return {
      entries: limited,
      total: filtered.length,
      enhanced: limited.filter(e => e.type === 'enhanced_security_decision').length,
      analysisAvailable: this.analysisResults.size
    };
  }

  /**
   * Get security analytics with trace analysis insights
   */
  async getSecurityAnalytics(timeRange = '24h') {
    const basicStats = await super.getSecurityStats(timeRange);
    
    // Add trace analysis insights
    const cutoffTime = this.getCutoffTime(timeRange);
    const recentTraces = this.traceStorage.filter(trace => 
      new Date(trace.timestamp) > cutoffTime
    );
    
    const traceAnalytics = {
      totalTracesAnalyzed: recentTraces.length,
      
      riskDistribution: this.calculateRiskDistribution(recentTraces),
      
      promptInjectionAttempts: recentTraces.filter(trace => 
        trace.analysis?.analyses?.promptInjection?.detected
      ).length,
      
      anomaliesDetected: recentTraces.reduce((sum, trace) => 
        sum + this.countAnomalies(trace.analysis), 0
      ),
      
      averageAnalysisTime: this.calculateAverageAnalysisTime(recentTraces),
      
      topAnomalyTypes: this.getTopAnomalyTypes(recentTraces),
      
      confidenceMetrics: {
        averageConfidence: this.calculateAverageConfidence(recentTraces),
        highConfidenceDetections: recentTraces.filter(trace => 
          (trace.analysis?.confidence || 0) > 0.8
        ).length
      }
    };
    
    return {
      ...basicStats,
      traceAnalytics: traceAnalytics,
      enhancedCapabilities: {
        programAnalysis: true,
        promptInjectionDetection: true,
        anomalyDetection: true,
        traceStorage: true
      }
    };
  }

  /**
   * Get learning insights from trace analysis
   */
  async getLearningInsights(limit = 100) {
    const recentTraces = this.traceStorage.slice(-limit);
    
    return {
      totalTraces: recentTraces.length,
      
      patterns: {
        commonAnomalies: this.identifyCommonAnomalies(recentTraces),
        riskPatterns: this.identifyRiskPatterns(recentTraces),
        falsePositives: this.identifyPotentialFalsePositives(recentTraces)
      },
      
      recommendations: {
        policyUpdates: this.suggestPolicyUpdates(recentTraces),
        thresholdAdjustments: this.suggestThresholdAdjustments(recentTraces),
        newDetectionRules: this.suggestNewDetectionRules(recentTraces)
      },
      
      performance: {
        averageAnalysisTime: this.calculateAverageAnalysisTime(recentTraces),
        accuracyMetrics: this.calculateAccuracyMetrics(recentTraces)
      }
    };
  }

  /**
   * Helper methods
   */
  countAnomalies(analysis) {
    if (!analysis || !analysis.analyses) return 0;
    
    let count = 0;
    Object.values(analysis.analyses).forEach(subAnalysis => {
      if (subAnalysis && subAnalysis.indicators) {
        count += subAnalysis.indicators.length;
      }
    });
    
    return count;
  }

  calculateRiskDistribution(traces) {
    const distribution = { minimal: 0, low: 0, medium: 0, high: 0, critical: 0, unknown: 0 };
    
    traces.forEach(trace => {
      const risk = trace.analysis?.overallRisk || 'unknown';
      distribution[risk] = (distribution[risk] || 0) + 1;
    });
    
    return distribution;
  }

  calculateAverageAnalysisTime(traces) {
    if (traces.length === 0) return 0;
    
    const totalTime = traces.reduce((sum, trace) => 
      sum + (trace.analysis?.analysisTime || 0), 0
    );
    
    return Math.round(totalTime / traces.length);
  }

  calculateAverageConfidence(traces) {
    if (traces.length === 0) return 0;
    
    const totalConfidence = traces.reduce((sum, trace) => 
      sum + (trace.analysis?.confidence || 0), 0
    );
    
    return Math.round((totalConfidence / traces.length) * 100) / 100;
  }

  getTopAnomalyTypes(traces) {
    const anomalyTypes = {};
    
    traces.forEach(trace => {
      if (trace.analysis?.analyses) {
        Object.values(trace.analysis.analyses).forEach(analysis => {
          if (analysis.indicators) {
            analysis.indicators.forEach(indicator => {
              anomalyTypes[indicator.type] = (anomalyTypes[indicator.type] || 0) + 1;
            });
          }
        });
      }
    });
    
    return Object.entries(anomalyTypes)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));
  }

  generateTraceId() {
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Placeholder methods for advanced learning (to be implemented)
  identifyCommonAnomalies(traces) { return []; }
  identifyRiskPatterns(traces) { return []; }
  identifyPotentialFalsePositives(traces) { return []; }
  suggestPolicyUpdates(traces) { return []; }
  suggestThresholdAdjustments(traces) { return []; }
  suggestNewDetectionRules(traces) { return []; }
  calculateAccuracyMetrics(traces) { return { accuracy: 0, precision: 0, recall: 0 }; }
}

// Export singleton instance
module.exports = new EnhancedAuditLogger();