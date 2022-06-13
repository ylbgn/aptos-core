use async_trait::async_trait;
use thiserror::Error;

// TODO: Consider using thiserror.

#[derive(Debug, Error)]
pub enum MetricCollectorError {}

/// todo describe the trait
/// todo assert these trait constraints are necessary
///
/// Note:
///  - Clone is required because multiple calls to spawn need to be static but also share
///      the same todo instance (mostly for the in-memory versions).
///
///  - Sync + Send is required because this will be a member of the todo which needs
///      to be used across async boundaries
///
///  - 'static is required because this will be stored on the todo which needs to be 'static
#[async_trait]
pub trait MetricCollector: Clone + Sync + Send + 'static {
    async fn collect_metrics(&self) -> Result<Vec<String>, MetricCollectorError>;
}
