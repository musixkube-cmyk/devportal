// Post-migration fixups + seed data
const fs = require('fs');
const { Pool } = require('pg');
const { createHash } = require('node:crypto');

const pool = new Pool({
  connectionString: 'postgresql://postgres.kcvjdxerjttjhrzygtrp:Bavin1863!!@aws-0-us-east-2.pooler.supabase.com:5432/postgres',
  max: 1,
  connectionTimeoutMillis: 30000,
  query_timeout: 60000,
});

// The Musicosy master API key — same one the user already has. Generate fresh.
const PREFIX = 'sk_live_';
const random = require('node:crypto').randomBytes(32);
const tail = random.toString('base64url');
const RAW_SECRET = `${PREFIX}${tail}`;
const KEY_HASH = createHash('sha256').update(RAW_SECRET).digest('hex');
const KEY_PREFIX = tail.slice(0, 8);
const KEY_LAST_FOUR = tail.slice(-4);

(async () => {
  const start = Date.now();
  console.log('[seed] starting');
  try {
    // 1. Relax over-strict NOT NULLs from schema.md so the dashboard can
    //    create rows without an organization context.
    await pool.query(`
      ALTER TABLE webhook_subscriptions ALTER COLUMN organization_id DROP NOT NULL;
      ALTER TABLE api_keys ALTER COLUMN scopes TYPE TEXT[] USING ARRAY[scopes::text];
      ALTER TABLE webhook_subscriptions ALTER COLUMN events TYPE TEXT[] USING ARRAY[events::text];
    `);
    console.log('[seed] relaxed NOT NULL constraints + converted scopes/events to TEXT[]');

    // 2. Seed: organization, user, api_key. Idempotent — uses ON CONFLICT.
    const org = await pool.query(`
      INSERT INTO organizations (id, name, slug, description, website)
      VALUES (
        '00000000-0000-0000-0000-000000000001',
        'Musicosy HQ',
        'musicosy-hq',
        'Default org for the Musicosy platform.',
        'https://musicosy.com'
      )
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `);
    const orgId = org.rows[0].id;
    console.log(`[seed] organization id=${orgId}`);

    const user = await pool.query(`
      INSERT INTO users (id, email, password_hash, display_name, role, verified)
      VALUES (
        '00000000-0000-0000-0000-000000000002',
        'admin@musicosy.com',
        crypt('Musicosy2026!', gen_salt('bf')),
        'Musicosy Admin',
        'admin',
        true
      )
      ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name
      RETURNING id;
    `);
    const userId = user.rows[0].id;
    console.log(`[seed] user id=${userId} email=admin@musicosy.com`);

    // Profile
    await pool.query(`
      INSERT INTO profiles (id, user_id, name, bio, visibility, verified)
      VALUES (
        '00000000-0000-0000-0000-000000000003',
        $1,
        'Musicosy Admin',
        'Platform administrator.',
        'public',
        true
      )
      ON CONFLICT (user_id) DO NOTHING;
    `, [userId]);

    // Link the user to the org as owner
    await pool.query(`
      INSERT INTO organization_users (organization_id, user_id, role, scopes, status)
      VALUES ($1, $2, 'owner', ARRAY['*'], 'active')
      ON CONFLICT (organization_id, user_id) DO NOTHING;
    `, [orgId, userId]);

    // 3. Seed the API key — this is what the user will use to call /api/v1/*
    const key = await pool.query(`
      INSERT INTO api_keys (
        id, organization_id, user_id, name, label,
        key_hash, prefix, last_four, scopes,
        revoked, created_at, updated_at
      ) VALUES (
        '00000000-0000-0000-0000-000000000010',
        $1, $2, 'Master Key', 'Master Key',
        $3, $4, $5, ARRAY['catalog_read','catalog_write','finance_read','finance_write','growth_read','growth_write','roster_read','roster_write','advertise_read','advertise_write','analytics_read'],
        false, now(), now()
      )
      ON CONFLICT (id) DO UPDATE SET
        key_hash = EXCLUDED.key_hash,
        prefix = EXCLUDED.prefix,
        last_four = EXCLUDED.last_four,
        revoked = false,
        updated_at = now()
      RETURNING id;
    `, [orgId, userId, KEY_HASH, KEY_PREFIX, KEY_LAST_FOUR]);
    console.log(`[seed] api_key id=${key.rows[0].id}`);

    // 4. Seed a sample webhook subscription
    await pool.query(`
      INSERT INTO webhook_subscriptions (
        organization_id, user_id, name, label, url, events, secret, status, enabled
      ) VALUES (
        $1, $2, 'Primary webhook', 'Primary webhook',
        'https://example.com/webhooks/musicosy',
        ARRAY['release.created','release.updated','payout.completed'],
        'whsec_samplesecret',
        'active', true
      )
      ON CONFLICT DO NOTHING;
    `, [orgId, userId]);

    // 5. Seed one row in each of 27 domain tables so the API gateway has
    //    something to return. Use a single UUID for IDs to keep FKs consistent.
    const sampleOrgId = orgId;
    const sampleUserId = userId;
    const sampleReleaseId = 'a0000000-0000-0000-0000-000000000001';
    const sampleAssetId = 'a0000000-0000-0000-0000-000000000002';
    const samplePostId = 'a0000000-0000-0000-0000-000000000003';

    // D8: catalog
    await pool.query(`
      INSERT INTO releases (id, organization_id, title, artist, type, status, isrc, upc, release_date, explicit, language, description, genre, mood, credits)
      VALUES ($1, $2, 'Midnight Protocol', 'Neon Cipher', 'single', 'live', 'USX012345678', '0123456789012', now(), false, 'en', 'Debut single.', ARRAY['Electronic','Synthwave'], ARRAY['energetic'], '{"producer":"Neon Cipher"}')
      ON CONFLICT (id) DO NOTHING;
    `, [sampleReleaseId, sampleOrgId]);

    await pool.query(`
      INSERT INTO assets (id, name, type, url, size, mime_type, processing_status, uploaded_by)
      VALUES ($1, 'midnight-protocol.mp3', 'audio', 'https://cdn.musicosy.com/assets/midnight-protocol.mp3', 8500000, 'audio/mpeg', 'ready', $2)
      ON CONFLICT (id) DO NOTHING;
    `, [sampleAssetId, sampleUserId]);

    // D3: posts
    await pool.query(`
      INSERT INTO posts (id, author_id, type, text, visibility, status, published_at)
      VALUES ($1, $2, 'post', 'New single out now.', 'public', 'published', now())
      ON CONFLICT (id) DO NOTHING;
    `, [samplePostId, sampleUserId]);

    // D11: events
    await pool.query(`
      INSERT INTO events (id, organization_id, name, type, date, venue, capacity, price, status)
      VALUES ('b0000000-0000-0000-0000-000000000001', $1, 'Album Release Show', 'concert', now() + interval '7 days', 'The Roxy, LA', 500, 25.00, 'scheduled')
      ON CONFLICT (id) DO NOTHING;
    `, [sampleOrgId]);

    // D11: tours
    await pool.query(`
      INSERT INTO tours (id, organization_id, artist_id, name, status)
      VALUES ('b0000000-0000-0000-0000-000000000002', $1, $2, 'Midnight Tour', 'active')
      ON CONFLICT (id) DO NOTHING;
    `, [sampleOrgId, sampleUserId]);

    // D10: talent
    await pool.query(`
      INSERT INTO talent (id, organization_id, name, genre, location, streams, followers, engagement, status)
      VALUES ('b0000000-0000-0000-0000-000000000003', $1, 'Neon Cipher', ARRAY['Synthwave'], 'Los Angeles', 1250000, 45000, 8.5, 'signed')
      ON CONFLICT (id) DO NOTHING;
    `, [sampleOrgId]);

    // D10: contracts
    await pool.query(`
      INSERT INTO contracts (id, organization_id, type, counterparty, terms, status, start_date, end_date)
      VALUES ('b0000000-0000-0000-0000-000000000004', $1, 'recording', 'Neon Cipher', '{"advance":50000,"royalty":0.15}', 'active', now(), now() + interval '1 year')
      ON CONFLICT (id) DO NOTHING;
    `, [sampleOrgId]);

    // D9: payouts
    await pool.query(`
      INSERT INTO payouts (id, recipient_id, recipient_name, amount, currency, method, status, scheduled_date)
      VALUES ('b0000000-0000-0000-0000-000000000005', $1, 'Neon Cipher', 4250.00, 'USD', 'stripe', 'pending', now() + interval '14 days')
      ON CONFLICT (id) DO NOTHING;
    `, [sampleUserId]);

    // D9: royalty_statements
    await pool.query(`
      INSERT INTO royalty_statements (id, organization_id, source, source_name, period_start, period_end, format, status, total_revenue)
      VALUES ('b0000000-0000-0000-0000-000000000006', $1, 'spotify', 'Spotify', date_trunc('month', now() - interval '1 month'), date_trunc('month', now()) - interval '1 second', 'csv', 'processed', 18420.50)
      ON CONFLICT (id) DO NOTHING;
    `, [sampleOrgId]);

    // D22: ad_campaigns
    await pool.query(`
      INSERT INTO ad_campaigns (id, organization_id, name, objective, delivery_goal, status, daily_budget, spent, start_date, end_date)
      VALUES ('b0000000-0000-0000-0000-000000000007', $1, 'Summer Tour Promo', 'traffic', 'clicks', 'active', 100.00, 325.50, now() - interval '5 days', now() + interval '25 days')
      ON CONFLICT (id) DO NOTHING;
    `, [sampleOrgId]);

    // D27: podcast_shows
    await pool.query(`
      INSERT INTO podcast_shows (id, organization_id, name, description, status, rss_url)
      VALUES ('b0000000-0000-0000-0000-000000000008', $1, 'Behind the Mix', 'Interviews with producers.', 'published', 'https://cdn.musicosy.com/rss/behind-the-mix.xml')
      ON CONFLICT (id) DO NOTHING;
    `, [sampleOrgId]);

    // D27: podcast_episodes
    await pool.query(`
      INSERT INTO podcast_episodes (id, show_id, title, audio_url, duration, season, episode_number, status, published_at)
      VALUES ('b0000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000008', 'Episode 1: Synthwave Origins', 'https://cdn.musicosy.com/podcasts/ep1.mp3', 2400, 1, 1, 'published', now())
      ON CONFLICT (id) DO NOTHING;
    `);

    // D15: analytics_events
    await pool.query(`
      INSERT INTO analytics_events (user_id, event_type, entity_type, entity_id, metadata)
      VALUES ($1, 'stream', 'release', $2, '{"duration":180,"completion":0.95}')
      ON CONFLICT DO NOTHING;
    `, [sampleUserId, sampleReleaseId]);

    // D14: search_index
    await pool.query(`
      INSERT INTO search_index (entity_type, entity_id, title, body, tags, score)
      VALUES ('release', $1, 'Midnight Protocol', 'Debut single by Neon Cipher', ARRAY['synthwave','electronic'], 1.0)
      ON CONFLICT DO NOTHING;
    `, [sampleReleaseId]);

    // D26: service_status
    await pool.query(`
      INSERT INTO service_status (service, status, uptime, latency)
      VALUES ('api_gateway', 'operational', 99.99, 42)
      ON CONFLICT (service) DO NOTHING;
    `);

    // D26: incidents
    await pool.query(`
      INSERT INTO incidents (title, severity, description, status)
      VALUES ('No active incidents', 'none', 'All systems operational.', 'resolved')
      ON CONFLICT DO NOTHING;
    `);

    // D26: rate_limit_rules
    await pool.query(`
      INSERT INTO rate_limit_rules (endpoint, "limit", "window")
      VALUES ('/v1/*', 1000, 60)
      ON CONFLICT DO NOTHING;
    `);

    // D19: notifications
    await pool.query(`
      INSERT INTO notifications (user_id, type, title, body, read)
      VALUES ($1, 'system', 'Welcome to Musicosy', 'Your developer account is ready.', false)
      ON CONFLICT DO NOTHING;
    `, [sampleUserId]);

    // D20: feature_flags
    await pool.query(`
      INSERT INTO feature_flags (name, description, enabled, percentage)
      VALUES ('new_dashboard', 'Next-gen dashboard UI', true, 100)
      ON CONFLICT (name) DO NOTHING;
    `);

    // D20: tier_plans
    await pool.query(`
      INSERT INTO tier_plans (name, features, limits, price, currency, billing_cycle)
      VALUES ('Pro', ARRAY['unlimited_keys','webhooks','analytics'], '{"requests_per_month":1000000}', 99.00, 'USD', 'monthly')
      ON CONFLICT DO NOTHING;
    `);

    // D25: policies
    await pool.query(`
      INSERT INTO policies (name, version, content)
      VALUES ('terms_of_service', '1.0', 'Musicosy Terms of Service v1.0')
      ON CONFLICT (name) DO NOTHING;
    `);

    // D25: compliance_records
    await pool.query(`
      INSERT INTO compliance_records (organization_id, type, data, status)
      VALUES ($1, 'tax', '{"form":"W-9"}', 'verified')
      ON CONFLICT DO NOTHING;
    `, [sampleOrgId]);

    // D24: support_tickets
    await pool.query(`
      INSERT INTO support_tickets (user_id, subject, message, priority, category, status)
      VALUES ($1, 'How do I rotate my API key?', 'See subject.', 'low', 'api', 'open')
      ON CONFLICT DO NOTHING;
    `, [sampleUserId]);

    // D23: safety_reports
    await pool.query(`
      INSERT INTO safety_reports (content_id, content_title, reporter_id, reason, status)
      VALUES ($1, 'Sample content', $2, 'spam', 'pending')
      ON CONFLICT DO NOTHING;
    `, [sampleReleaseId, sampleUserId]);

    // D21: connectors
    await pool.query(`
      INSERT INTO connectors (name, category, description, config)
      VALUES ('Spotify for Artists', 'distribution', 'Sync streaming data.', '{"scopes":["read-analytics"]}')
      ON CONFLICT DO NOTHING;
    `);

    // D13: smart_links
    await pool.query(`
      INSERT INTO smart_links (organization_id, destination, type, campaign, clicks, conversions, conversion_rate)
      VALUES ($1, 'https://musicosy.com/links/midnight-protocol', 'release', 'summer_tour', 4521, 312, 0.069)
      ON CONFLICT DO NOTHING;
    `, [sampleOrgId]);

    // D13: social_accounts
    await pool.query(`
      INSERT INTO social_accounts (organization_id, platform, name, verified)
      VALUES ($1, 'instagram', '@neoncipher', true)
      ON CONFLICT DO NOTHING;
    `, [sampleOrgId]);

    // D12: epks
    await pool.query(`
      INSERT INTO epks (artist_id, bio, published)
      VALUES ($1, 'Electronic producer from LA.', true)
      ON CONFLICT DO NOTHING;
    `, [sampleUserId]);

    // D12: sites
    await pool.query(`
      INSERT INTO sites (organization_id, name, domain, pages, branding, published)
      VALUES ($1, 'Musicosy Main', 'musicosy.com', '{}', '{"primary":"#7C3AED"}', true)
      ON CONFLICT DO NOTHING;
    `, [sampleOrgId]);

    // D7: products
    await pool.query(`
      INSERT INTO products (user_id, name, description, type, category, status, base_price, currency, total_inventory, available_inventory)
      VALUES ($1, 'Midnight T-Shirt', 'Tour merch.', 'physical', 'apparel', 'active', 30.00, 'USD', 200, 187)
      ON CONFLICT DO NOTHING;
    `, [sampleUserId]);

    // D7: orders
    await pool.query(`
      INSERT INTO orders (user_id, total, currency, status, shipping_address)
      VALUES ($1, 60.00, 'USD', 'paid', '{"line1":"123 Main St","city":"LA","state":"CA","zip":"90001","country":"US"}')
      ON CONFLICT DO NOTHING;
    `, [sampleUserId]);

    // D7: subscriptions
    await pool.query(`
      INSERT INTO subscriptions (user_id, creator_id, tier, price, currency, billing_cycle, status, next_billing_date, perks)
      VALUES ($1, $1, 'Pro', 9.99, 'USD', 'monthly', 'active', now() + interval '30 days', ARRAY['exclusive_streams'])
      ON CONFLICT DO NOTHING;
    `, [sampleUserId]);

    // D7: playlists
    await pool.query(`
      INSERT INTO playlists (creator_id, name, description, is_public, collaborative, track_count)
      VALUES ($1, 'Synthwave Essentials', 'Curated picks.', true, false, 25)
      ON CONFLICT DO NOTHING;
    `, [sampleUserId]);

    // D5: live_streams
    await pool.query(`
      INSERT INTO live_streams (creator_id, title, description, status, scheduled_start, tipping_enabled, merch_enabled)
      VALUES ($1, 'Album Release Live', 'Live Q&A and performance.', 'scheduled', now() + interval '3 days', true, true)
      ON CONFLICT DO NOTHING;
    `, [sampleUserId]);

    // D4: conversations + messages
    const conv = await pool.query(`
      INSERT INTO conversations (type)
      VALUES ('direct')
      RETURNING id;
    `);
    const convId = conv.rows[0].id;
    await pool.query(`
      INSERT INTO conversation_participants (conversation_id, user_id)
      VALUES ($1, $2), ($1, $2)
      ON CONFLICT DO NOTHING;
    `, [convId, sampleUserId]);
    await pool.query(`
      INSERT INTO messages (conversation_id, sender_id, text)
      VALUES ($1, $2, 'Welcome to Musicosy DMs!')
      ON CONFLICT DO NOTHING;
    `, [convId, sampleUserId]);

    // D2: feed_items
    await pool.query(`
      INSERT INTO feed_items (user_id, item_type, item_id, score)
      VALUES ($1, 'release', $2, 1.0)
      ON CONFLICT DO NOTHING;
    `, [sampleUserId, sampleReleaseId]);

    // D2: trending_items
    await pool.query(`
      INSERT INTO trending_items (item_type, item_id, rank, velocity, timeframe)
      VALUES ('release', $1, 1, 0.85, '24h')
      ON CONFLICT DO NOTHING;
    `, [sampleReleaseId]);

    // D6: governance_settings
    await pool.query(`
      INSERT INTO governance_settings (asset_id, asset_type, visibility, delivery_state)
      VALUES ($1, 'release', 'public', 'free')
      ON CONFLICT (asset_id, asset_type) DO NOTHING;
    `, [sampleReleaseId]);

    // D16: mastering_jobs
    await pool.query(`
      INSERT INTO mastering_jobs (user_id, audio_asset_id, profile, status)
      VALUES ($1, $2, 'standard', 'completed')
      ON CONFLICT DO NOTHING;
    `, [sampleUserId, sampleAssetId]);

    // D17: uploads
    await pool.query(`
      INSERT INTO uploads (user_id, purpose, filename, content_type, size, status, progress, expires_at)
      VALUES ($1, 'release_audio', 'midnight-protocol.mp3', 'audio/mpeg', 8500000, 'completed', 100, now() + interval '1 hour')
      ON CONFLICT DO NOTHING;
    `, [sampleUserId]);

    // D18: payment_methods
    await pool.query(`
      INSERT INTO payment_methods (user_id, type, provider, provider_id, last4, expiry, is_default)
      VALUES ($1, 'card', 'stripe', 'pm_12345', '4242', '12/27', true)
      ON CONFLICT DO NOTHING;
    `, [sampleUserId]);

    // D18: transactions
    await pool.query(`
      INSERT INTO transactions (user_id, type, amount, currency, status, provider_id)
      VALUES ($1, 'subscription', 9.99, 'USD', 'succeeded', 'pi_12345')
      ON CONFLICT DO NOTHING;
    `, [sampleUserId]);

    console.log(`[seed] DONE in ${Date.now() - start}ms`);
    console.log('---');
    console.log('API KEY (save this — only shown once):');
    console.log(RAW_SECRET);
    console.log('---');
    console.log('Login: admin@musicosy.com / Musicosy2026!');

    // Verify
    const verify = await pool.query(`
      SELECT
        (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE') AS tables,
        (SELECT count(*) FROM api_keys WHERE revoked = false) AS active_keys,
        (SELECT count(*) FROM releases) AS releases,
        (SELECT count(*) FROM notifications) AS notifications;
    `);
    console.log('---');
    console.log(`[verify] tables=${verify.rows[0].tables} active_keys=${verify.rows[0].active_keys} releases=${verify.rows[0].releases} notifications=${verify.rows[0].notifications}`);

  } catch (e) {
    console.error(`[seed] FAILED after ${Date.now() - start}ms`);
    console.error(e.message);
    if (e.position) {
      console.error('Position:', e.position);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
