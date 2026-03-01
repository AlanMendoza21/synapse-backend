const pool = require('../db/pool');
const config = require('../config/env');

async function trackUsage(userId, action, usageMetadata) {
  const { promptTokens, completionTokens, model } = usageMetadata;
  const totalTokens = promptTokens + completionTokens;

  const inputCost = (promptTokens / 1_000_000) * config.gemini.inputPricePerM;
  const outputCost = (completionTokens / 1_000_000) * config.gemini.outputPricePerM;
  const costUsd = inputCost + outputCost;

  await pool.query(
    `INSERT INTO token_usage (user_id, action, prompt_tokens, completion_tokens, total_tokens, model, cost_usd)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [userId, action, promptTokens, completionTokens, totalTokens, model, costUsd]
  );

  return { promptTokens, completionTokens, totalTokens, costUsd };
}

async function getUserUsage(userId, period) {
  let dateFilter;
  if (period === 'today') {
    dateFilter = "created_at::date = CURRENT_DATE";
  } else if (period === 'week') {
    dateFilter = "created_at >= CURRENT_DATE - INTERVAL '7 days'";
  } else {
    dateFilter = "created_at >= CURRENT_DATE - INTERVAL '30 days'";
  }

  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(prompt_tokens), 0) as prompt_tokens,
            COALESCE(SUM(completion_tokens), 0) as completion_tokens,
            COALESCE(SUM(total_tokens), 0) as total_tokens,
            COALESCE(SUM(cost_usd), 0) as cost_usd
     FROM token_usage WHERE user_id = $1 AND ${dateFilter}`,
    [userId]
  );

  return rows[0];
}

module.exports = { trackUsage, getUserUsage };
