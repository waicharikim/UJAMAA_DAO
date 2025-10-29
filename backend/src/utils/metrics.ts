/**
 * @file metrics.ts
 * 
 * @description
 * UJAMAADAO Enhanced Metrics and Monitoring System
 * 
 * Comprehensive metrics collection for the UJAMAADAO platform using Prometheus.
 * Provides monitoring for geographic operations, economic system performance,
 * verification workflows, and community governance activities.
 * 
 * UJAMAADAO SPECIFIC ENHANCEMENTS:
 * - Geographic operation metrics (ward, constituency, county levels)
 * - Economic system monitoring (IP, UT, PR transactions)
 * - Verification workflow tracking and performance
 * - Community governance activity metrics
 * - Security event monitoring and classification
 * - Performance metrics for location-based operations
 * 
 * Metric Categories:
 * - AUTHENTICATION: User authentication and session management
 * - GEOGRAPHIC: Location-based operations and hierarchy navigation
 * - ECONOMIC: Three-tier economic system transactions
 * - VERIFICATION: Progressive verification workflow tracking
 * - GOVERNANCE: Community governance and voting operations
 * - SECURITY: Security events and access control violations
 * - PERFORMANCE: Operation timing and system performance
 */

import client from 'prom-client';
import logger from './logger.js';

// Initialize default metrics collection
client.collectDefaultMetrics({
  labels: { 
    platform: 'UJAMAADAO',
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  }
});

// ============================================================================
// AUTHENTICATION & SESSION METRICS
// ============================================================================

export const attachUserRolesDbErrors = new client.Counter({
  name: 'ujamaadao_attach_user_roles_db_errors_total',
  help: 'Total database errors during user role attachment',
  labelNames: ['error_type', 'operation'] as const,
});

export const attachUserRolesJwtRejected = new client.Counter({
  name: 'ujamaadao_attach_user_roles_jwt_rejected_total',
  help: 'Total JWT roles rejected during validation',
  labelNames: ['reason', 'role_type'] as const,
});

export const attachUserRolesDuration = new client.Histogram({
  name: 'ujamaadao_attach_user_roles_duration_seconds',
  help: 'Duration of user role attachment process in seconds',
  labelNames: ['verification_level', 'role_count'] as const,
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2],
});

export const userAuthenticationTotal = new client.Counter({
  name: 'ujamaadao_user_authentication_total',
  help: 'Total user authentication attempts',
  labelNames: ['method', 'verification_level', 'success'] as const,
});

export const userSessionDuration = new client.Histogram({
  name: 'ujamaadao_user_session_duration_seconds',
  help: 'Duration of user sessions in seconds',
  labelNames: ['verification_level', 'geographic_scope'] as const,
  buckets: [300, 900, 1800, 3600, 7200, 14400, 28800, 57600, 115200], // 5min to 32hrs
});

// ============================================================================
// GEOGRAPHIC OPERATION METRICS
// ============================================================================

export const geographicOperationsTotal = new client.Counter({
  name: 'ujamaadao_geographic_operations_total',
  help: 'Total geographic operations performed',
  labelNames: ['operation_type', 'geographic_level', 'success'] as const,
});

export const geographicHierarchyResolveDuration = new client.Histogram({
  name: 'ujamaadao_geographic_hierarchy_resolve_duration_seconds',
  help: 'Duration of geographic hierarchy resolution in seconds',
  labelNames: ['hierarchy_depth', 'source_level'] as const,
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
});

export const wardOperationsTotal = new client.Counter({
  name: 'ujamaadao_ward_operations_total',
  help: 'Total operations performed at ward level',
  labelNames: ['operation_type', 'ward_id', 'success'] as const,
});

export const constituencyOperationsTotal = new client.Counter({
  name: 'ujamaadao_constituency_operations_total',
  help: 'Total operations performed at constituency level',
  labelNames: ['operation_type', 'constituency_id', 'success'] as const,
});

export const countyOperationsTotal = new client.Counter({
  name: 'ujamaadao_county_operations_total',
  help: 'Total operations performed at county level',
  labelNames: ['operation_type', 'county_id', 'success'] as const,
});

// ============================================================================
// ECONOMIC SYSTEM METRICS
// ============================================================================

export const impactPointTransactionsTotal = new client.Counter({
  name: 'ujamaadao_impact_point_transactions_total',
  help: 'Total impact point transactions processed',
  labelNames: ['transaction_type', 'location_scope', 'tier'] as const,
});

export const impactPointsTotal = new client.Counter({
  name: 'ujamaadao_impact_points_total',
  help: 'Total impact points awarded across the platform',
  labelNames: ['award_type', 'geographic_scope'] as const,
});

export const utilityTokenTransactionsTotal = new client.Counter({
  name: 'ujamaadao_utility_token_transactions_total',
  help: 'Total utility token transactions processed',
  labelNames: ['transaction_type', 'amount_range', 'success'] as const,
});

export const utilityTokensVolume = new client.Counter({
  name: 'ujamaadao_utility_tokens_volume_total',
  help: 'Total volume of utility tokens transacted',
  labelNames: ['transaction_type'] as const,
});

export const participationRightsUsage = new client.Counter({
  name: 'ujamaadao_participation_rights_usage_total',
  help: 'Total participation rights used for governance',
  labelNames: ['governance_type', 'geographic_level'] as const,
});

export const economicTierDistribution = new client.Gauge({
  name: 'ujamaadao_economic_tier_distribution',
  help: 'Distribution of users across economic tiers',
  labelNames: ['tier', 'geographic_level'] as const,
});

// ============================================================================
// VERIFICATION SYSTEM METRICS
// ============================================================================

export const verificationAttemptsTotal = new client.Counter({
  name: 'ujamaadao_verification_attempts_total',
  help: 'Total verification attempts across all types',
  labelNames: ['verification_type', 'success', 'failure_reason'] as const,
});

export const verificationLevelDistribution = new client.Gauge({
  name: 'ujamaadao_verification_level_distribution',
  help: 'Distribution of users across verification levels',
  labelNames: ['verification_level', 'geographic_scope'] as const,
});

export const verificationWorkflowDuration = new client.Histogram({
  name: 'ujamaadao_verification_workflow_duration_seconds',
  help: 'Duration of verification workflows in seconds',
  labelNames: ['verification_type', 'completion_status'] as const,
  buckets: [30, 60, 300, 900, 1800, 3600, 7200, 14400], // 30s to 4hrs
});

export const verificationCompletionRate = new client.Counter({
  name: 'ujamaadao_verification_completion_rate_total',
  help: 'Verification completion rate by type and geographic area',
  labelNames: ['verification_type', 'geographic_level', 'completed'] as const,
});

// ============================================================================
// GOVERNANCE & VOTING METRICS
// ============================================================================

export const governanceProposalsTotal = new client.Counter({
  name: 'ujamaadao_governance_proposals_total',
  help: 'Total governance proposals created',
  labelNames: ['proposal_type', 'geographic_level', 'status'] as const,
});

export const votingOperationsTotal = new client.Counter({
  name: 'ujamaadao_voting_operations_total',
  help: 'Total voting operations performed',
  labelNames: ['vote_type', 'geographic_level', 'success'] as const,
});

export const votingWeightDistribution = new client.Histogram({
  name: 'ujamaadao_voting_weight_distribution',
  help: 'Distribution of voting weights across users',
  labelNames: ['geographic_level'] as const,
  buckets: [0.5, 1.0, 1.5, 2.0, 2.5, 3.0],
});

export const governanceParticipationRate = new client.Gauge({
  name: 'ujamaadao_governance_participation_rate',
  help: 'Governance participation rate by geographic level',
  labelNames: ['geographic_level', 'proposal_type'] as const,
});

// ============================================================================
// SECURITY & ACCESS CONTROL METRICS
// ============================================================================

export const securityEventsTotal = new client.Counter({
  name: 'ujamaadao_security_events_total',
  help: 'Total security events detected',
  labelNames: ['event_type', 'severity', 'geographic_context'] as const,
});

export const accessControlViolations = new client.Counter({
  name: 'ujamaadao_access_control_violations_total',
  help: 'Total access control violations',
  labelNames: ['violation_type', 'required_level', 'user_level'] as const,
});

export const geographicAccessViolations = new client.Counter({
  name: 'ujamaadao_geographic_access_violations_total',
  help: 'Total geographic access violations',
  labelNames: ['required_scope', 'user_scope', 'operation_type'] as const,
});

export const economicSystemViolations = new client.Counter({
  name: 'ujamaadao_economic_system_violations_total',
  help: 'Total economic system violations',
  labelNames: ['violation_type', 'required_tier', 'user_tier'] as const,
});

// ============================================================================
// PERFORMANCE & SYSTEM HEALTH METRICS
// ============================================================================

export const apiRequestDuration = new client.Histogram({
  name: 'ujamaadao_api_request_duration_seconds',
  help: 'Duration of API requests in seconds',
  labelNames: ['method', 'route', 'status_code', 'geographic_scope'] as const,
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
});

export const databaseOperationDuration = new client.Histogram({
  name: 'ujamaadao_database_operation_duration_seconds',
  help: 'Duration of database operations in seconds',
  labelNames: ['operation', 'table', 'success'] as const,
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
});

export const cacheHitRate = new client.Counter({
  name: 'ujamaadao_cache_operations_total',
  help: 'Cache hit and miss operations',
  labelNames: ['cache_type', 'operation', 'hit'] as const,
});

export const activeUsersGauge = new client.Gauge({
  name: 'ujamaadao_active_users_total',
  help: 'Number of active users by verification level and geographic scope',
  labelNames: ['verification_level', 'geographic_scope'] as const,
});

// ============================================================================
// BUSINESS PROCESS METRICS
// ============================================================================

export const userRegistrationTotal = new client.Counter({
  name: 'ujamaadao_user_registration_total',
  help: 'Total user registrations by geographic area',
  labelNames: ['geographic_level', 'with_geographic_data', 'success'] as const,
});

export const userRetentionRate = new client.Gauge({
  name: 'ujamaadao_user_retention_rate',
  help: 'User retention rate by verification level and geographic area',
  labelNames: ['verification_level', 'geographic_level', 'time_period'] as const,
});

export const economicActivityGauge = new client.Gauge({
  name: 'ujamaadao_economic_activity_level',
  help: 'Level of economic activity by geographic area',
  labelNames: ['geographic_level', 'activity_type'] as const,
});

export const communityEngagementRate = new client.Gauge({
  name: 'ujamaadao_community_engagement_rate',
  help: 'Community engagement rate by geographic level',
  labelNames: ['geographic_level', 'engagement_type'] as const,
});

// ============================================================================
// METRICS EXPORT HANDLER
// ============================================================================

/**
 * UJAMAADAO Enhanced Metrics Handler
 * 
 * Provides Prometheus metrics endpoint with comprehensive UJAMAADAO platform data.
 * Includes geographic, economic, and verification system metrics for monitoring.
 * 
 * @param req - Express request object
 * @param res - Express response object
 */
export async function metricsHandler(req: any, res: any) {
  try {
    // Set response headers for Prometheus
    res.setHeader('Content-Type', client.register.contentType);
    
    // Generate metrics with UJAMAADAO context
    const metrics = await client.register.metrics();
    
    // Add custom UJAMAADAO metrics commentary
    const enhancedMetrics = `# UJAMAADAO Platform Metrics
# Platform: Community Governance and Economic System
# Version: ${process.env.APP_VERSION || '1.0.0'}
# Environment: ${process.env.NODE_ENV || 'development'}
# Geographic Hierarchy: Ward → Constituency → County → National
# Economic System: Three-tier (IP, UT, PR)
# Verification: Progressive (Phone → Community → Location)
\n${metrics}`;
    
    res.end(enhancedMetrics);
    
  } catch (err) {
    const error = err as Error;
    logger.error('UJAMAADAO Metrics: Failed to generate metrics', {
      error: error.message,
      stack: error.stack
    } as any);
    
    res.status(500).json({
      error: 'Metrics generation failed',
      message: error.message,
      code: 'METRICS_ERROR'
    });
  }
}

/**
 * UJAMAADAO Metrics Utility Functions
 * 
 * Helper functions for common metric recording patterns in the platform.
 */

/**
 * Record Geographic Operation Metric
 * 
 * Helper function to record metrics for geographic operations with
 * consistent labeling and error handling.
 */
export function recordGeographicOperation(
  operationType: string,
  geographicLevel: 'WARD' | 'CONSTITUENCY' | 'COUNTY' | 'NATIONAL',
  success: boolean,
  duration?: number
) {
  geographicOperationsTotal.inc({
    operation_type: operationType,
    geographic_level: geographicLevel,
    success: success.toString()
  });

  if (duration !== undefined) {
    // Record duration if provided
    apiRequestDuration.observe(
      {
        method: 'GEOGRAPHIC_OP',
        route: operationType,
        status_code: success ? '200' : '400',
        geographic_scope: geographicLevel
      },
      duration
    );
  }
}

/**
 * Record Economic Transaction Metric
 * 
 * Helper function to record metrics for economic system transactions
 * with three-tier system context.
 */
export function recordEconomicTransaction(
  transactionType: string,
  locationScope: string,
  tier: string,
  amount?: number
) {
  impactPointTransactionsTotal.inc({
    transaction_type: transactionType,
    location_scope: locationScope,
    tier: tier
  });

  if (amount && transactionType.includes('utility_token')) {
    utilityTokensVolume.inc({ transaction_type: transactionType }, amount);
  }
}

/**
 * Record Verification Event Metric
 * 
 * Helper function to record metrics for verification system events
 * with progressive workflow tracking.
 */
export function recordVerificationEvent(
  verificationType: string,
  success: boolean,
  failureReason?: string,
  duration?: number
) {
  verificationAttemptsTotal.inc({
    verification_type: verificationType,
    success: success.toString(),
    failure_reason: failureReason || 'none'
  });

  if (duration !== undefined && success) {
    verificationWorkflowDuration.observe(
      { verification_type: verificationType, completion_status: 'COMPLETED' },
      duration
    );
  }
}

/**
 * Record Security Event Metric
 * 
 * Helper function to record security events with severity classification
 * and geographic context.
 */
export function recordSecurityEvent(
  eventType: string,
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
  geographicContext?: string
) {
  securityEventsTotal.inc({
    event_type: eventType,
    severity: severity,
    geographic_context: geographicContext || 'UNKNOWN'
  });
}

// Export the Prometheus client for custom metric creation
export { client as prometheusClient };