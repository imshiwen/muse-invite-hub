CREATE TABLE IF NOT EXISTS submissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), manage_hash text NOT NULL UNIQUE,
 submit_idempotency_key uuid NOT NULL UNIQUE,
 submit_remaining integer CHECK(submit_remaining >= 0 AND submit_remaining <= 100000),
 submit_remaining_captured boolean NOT NULL DEFAULT true,
  actor_hash text NOT NULL, ip_hash text, created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 previous_manage_hash text,
 rotation_idempotency_key uuid
);
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS submit_idempotency_key uuid;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS submit_remaining integer;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS submit_remaining_captured boolean NOT NULL DEFAULT false;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS previous_manage_hash text;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS rotation_idempotency_key uuid;
CREATE TABLE IF NOT EXISTS codes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), submission_id uuid NOT NULL REFERENCES submissions(id),
 code text NOT NULL, code_key text NOT NULL UNIQUE,
 moderation text NOT NULL DEFAULT 'approved' CHECK(moderation IN ('pending','approved','needs_review','rejected')),
 remaining integer CHECK(remaining >= 0 AND remaining <= 100000), remaining_at timestamptz,
 retired_reason text, source text NOT NULL DEFAULT 'submitted' CHECK(source IN ('submitted','owner','community')),
 copy_count integer NOT NULL DEFAULT 0, reviewed_at timestamptz,
 review_note text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
-- Preserve a one-time baseline for databases created before this field existed.
-- It must not follow later owner quota edits, which are mutable code state.
UPDATE submissions s SET submit_remaining = (
  SELECT c.remaining FROM codes c WHERE c.submission_id=s.id ORDER BY c.created_at LIMIT 1
), submit_remaining_captured=true
WHERE s.submit_remaining_captured=false;
ALTER TABLE submissions ALTER COLUMN submit_remaining_captured SET DEFAULT true;
CREATE TABLE IF NOT EXISTS feedback (
 code_id uuid NOT NULL REFERENCES codes(id) ON DELETE CASCADE, actor_hash text NOT NULL,
 result text NOT NULL CHECK(result IN ('success','fail')), ip_hash text,
 eligible_for_status boolean NOT NULL DEFAULT true,
 observed_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(code_id,actor_hash)
);
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS eligible_for_status boolean NOT NULL DEFAULT true;
CREATE TABLE IF NOT EXISTS events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code_id uuid REFERENCES codes(id) ON DELETE CASCADE,
 kind text NOT NULL, actor_hash text, ip_hash text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS copy_gates (
 code_id uuid NOT NULL REFERENCES codes(id) ON DELETE CASCADE, subject text NOT NULL,
 last_counted_at timestamptz NOT NULL, PRIMARY KEY(code_id,subject)
);
CREATE TABLE IF NOT EXISTS rate_gates (key text PRIMARY KEY, hits timestamptz[] NOT NULL);
CREATE TABLE IF NOT EXISTS abuse_reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code_id uuid NOT NULL REFERENCES codes(id) ON DELETE CASCADE,
 actor_hash text NOT NULL, ip_hash text, reason text NOT NULL, note text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz
);
CREATE TABLE IF NOT EXISTS admin_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor text NOT NULL, code_id uuid,
 action text NOT NULL, reason text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS admin_sessions (
 session_hash text PRIMARY KEY,
 actor text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS admin_sessions_expiry_idx ON admin_sessions(expires_at);
CREATE INDEX IF NOT EXISTS feedback_time_idx ON feedback(code_id,observed_at);
CREATE INDEX IF NOT EXISTS submissions_time_idx ON submissions(ip_hash,created_at);
CREATE UNIQUE INDEX IF NOT EXISTS submissions_idempotency_idx ON submissions(submit_idempotency_key) WHERE submit_idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS abuse_time_idx ON abuse_reports(code_id,created_at);
CREATE INDEX IF NOT EXISTS events_time_idx ON events(created_at);

CREATE OR REPLACE VIEW code_state AS
SELECT c.*, COALESCE(s.work_count,0)::int AS work_count, s.last_success,
 COALESCE(f.fail_count,0)::int AS fail_count,
 CASE WHEN c.retired_reason IS NOT NULL OR c.remaining = 0 THEN 'retired'
 WHEN f.fail_count >= 3 AND f.ip_count >= 3 THEN 'likely_unavailable'
 WHEN s.last_success > now() - interval '24 hours' THEN 'active'
 ELSE 'uncertain' END AS status
FROM codes c
LEFT JOIN LATERAL (SELECT count(*) AS work_count, max(observed_at) AS last_success
 FROM feedback WHERE code_id=c.id AND result='success' AND eligible_for_status) s ON true
LEFT JOIN LATERAL (SELECT count(*) AS fail_count, count(DISTINCT ip_hash) AS ip_count
 FROM feedback WHERE code_id=c.id AND result='fail' AND eligible_for_status AND ip_hash IS NOT NULL
 AND observed_at > now()-interval '24 hours'
 AND observed_at > COALESCE(s.last_success,'-infinity'::timestamptz)) f ON true;

CREATE OR REPLACE FUNCTION take_rate(p_key text,p_limit int,p_seconds int) RETURNS boolean AS $$
DECLARE h timestamptz[];
BEGIN
 INSERT INTO rate_gates(key,hits) VALUES(p_key,'{}') ON CONFLICT DO NOTHING;
 SELECT hits INTO h FROM rate_gates WHERE key=p_key FOR UPDATE;
 SELECT COALESCE(array_agg(t),'{}') INTO h FROM unnest(h) t WHERE t>now()-make_interval(secs=>p_seconds);
 IF cardinality(h)>=p_limit THEN RETURN false; END IF;
 UPDATE rate_gates SET hits=array_append(h,now()) WHERE key=p_key;
 RETURN true;
END; $$ LANGUAGE plpgsql;

-- One database call is one atomic transaction, also through Neon HTTP.
CREATE OR REPLACE FUNCTION hub_action(p_action text,p_data jsonb,p_actor text,p_ip text)
RETURNS jsonb AS $$
DECLARE c codes; s submissions; f feedback; nid uuid; result jsonb; n int; ni int;
BEGIN
 IF p_action='submit' THEN
  PERFORM pg_advisory_xact_lock(hashtext('submit-id:'||(p_data->>'idempotency_key')));
  PERFORM pg_advisory_xact_lock(hashtext('submit:'||COALESCE(p_ip,p_actor)));
  SELECT * INTO s FROM submissions WHERE submit_idempotency_key=(p_data->>'idempotency_key')::uuid;
  IF FOUND THEN
   SELECT * INTO c FROM codes WHERE submission_id=s.id ORDER BY created_at LIMIT 1;
   IF s.manage_hash <> p_data->>'manage_hash' OR c.code_key <> p_data->>'code'
      OR s.submit_remaining IS DISTINCT FROM (p_data->>'remaining')::int THEN RAISE EXCEPTION 'CONFLICT'; END IF;
   RETURN jsonb_build_object('id',c.id,'moderation',c.moderation,'replayed',true);
  END IF;
  SELECT * INTO s FROM submissions WHERE manage_hash=p_data->>'manage_hash';
  IF FOUND THEN RAISE EXCEPTION 'CONFLICT'; END IF;
  IF EXISTS(SELECT 1 FROM codes WHERE code_key=p_data->>'code') THEN RAISE EXCEPTION 'DUPLICATE'; END IF;
  INSERT INTO submissions(manage_hash,submit_idempotency_key,submit_remaining,actor_hash,ip_hash)
   VALUES(p_data->>'manage_hash',(p_data->>'idempotency_key')::uuid,(p_data->>'remaining')::int,p_actor,p_ip) RETURNING * INTO s;
  SELECT count(*) INTO n FROM submissions WHERE id<>s.id AND created_at>now()-interval '24 hours'
    AND (actor_hash=p_actor OR (p_ip IS NOT NULL AND ip_hash=p_ip));
  INSERT INTO codes(submission_id,code,code_key,moderation,remaining,remaining_at)
   VALUES(s.id,p_data->>'code',p_data->>'code',CASE WHEN n>0 THEN 'pending' ELSE 'approved' END,
   (p_data->>'remaining')::int,CASE WHEN p_data->>'remaining' IS NOT NULL THEN now() END) RETURNING * INTO c;
  RETURN jsonb_build_object('id',c.id,'moderation',c.moderation);
 END IF;
 IF p_action LIKE 'manage_%' THEN
  SELECT * INTO s FROM submissions WHERE manage_hash=p_data->>'manage_hash' FOR UPDATE;
  IF NOT FOUND AND p_action='manage_rotate' THEN
   SELECT * INTO s FROM submissions
    WHERE previous_manage_hash=p_data->>'manage_hash'
      AND rotation_idempotency_key=(p_data->>'idempotency_key')::uuid
      AND manage_hash=p_data->>'new_hash'
    FOR UPDATE;
   IF FOUND THEN RETURN jsonb_build_object('ok',true,'replayed',true); END IF;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF p_action='manage_rotate' THEN
   IF p_data->>'new_hash'=s.manage_hash THEN RAISE EXCEPTION 'INVALID_ACTION'; END IF;
   UPDATE submissions SET previous_manage_hash=s.manage_hash,
    rotation_idempotency_key=(p_data->>'idempotency_key')::uuid,
    manage_hash=p_data->>'new_hash',updated_at=now() WHERE id=s.id;
   RETURN jsonb_build_object('ok',true);
  END IF;
  SELECT * INTO c FROM codes WHERE submission_id=s.id AND id=(p_data->>'id')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF p_action='manage_quota' THEN
   UPDATE codes SET remaining=(p_data->>'remaining')::int,
    remaining_at=CASE WHEN p_data->>'remaining' IS NULL THEN NULL ELSE now() END,
    retired_reason=CASE WHEN (p_data->>'remaining')::int=0 AND retired_reason IS NULL THEN 'quota_zero' ELSE retired_reason END,
    updated_at=now() WHERE id=c.id;
  ELSIF p_action='manage_pause' THEN
   IF c.retired_reason IN ('admin','replaced') THEN RAISE EXCEPTION 'LOCKED'; END IF;
   UPDATE codes SET retired_reason='owner',updated_at=now() WHERE id=c.id;
  ELSIF p_action='manage_resume' THEN
   IF c.moderation IN ('pending','rejected') OR c.retired_reason IN ('admin','replaced') THEN RAISE EXCEPTION 'LOCKED'; END IF;
   IF c.remaining=0 THEN RAISE EXCEPTION 'ZERO_QUOTA'; END IF;
   UPDATE codes SET retired_reason=NULL,updated_at=now() WHERE id=c.id;
  ELSIF p_action='manage_replace' THEN
   IF c.retired_reason='replaced' THEN
    SELECT id INTO nid FROM codes WHERE submission_id=s.id AND code_key=p_data->>'code';
    IF nid IS NOT NULL THEN RETURN jsonb_build_object('ok',true,'id',nid); END IF;
    RAISE EXCEPTION 'LOCKED';
   END IF;
   IF EXISTS(SELECT 1 FROM codes WHERE code_key=p_data->>'code') THEN RAISE EXCEPTION 'DUPLICATE'; END IF;
   UPDATE codes SET retired_reason='replaced',updated_at=now() WHERE id=c.id;
   -- Replacement always needs review; it must never bypass moderation.
   INSERT INTO codes(submission_id,code,code_key,moderation) VALUES(s.id,p_data->>'code',p_data->>'code','pending') RETURNING id INTO nid;
  ELSE RAISE EXCEPTION 'INVALID_ACTION'; END IF;
  INSERT INTO events(code_id,kind,actor_hash) VALUES(c.id,p_action,p_actor);
  RETURN jsonb_build_object('ok',true,'id',COALESCE(nid,c.id));
 END IF;
 SELECT * INTO c FROM codes WHERE id=(p_data->>'id')::uuid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 IF p_action LIKE 'admin_%' THEN
  IF p_action='admin_approve' THEN
   UPDATE codes SET moderation='approved',review_note=NULL,reviewed_at=now(),updated_at=now() WHERE id=c.id;
  ELSIF p_action='admin_reject' THEN
   UPDATE codes SET moderation='rejected',retired_reason='admin',review_note=p_data->>'reason',reviewed_at=now(),updated_at=now() WHERE id=c.id;
  ELSIF p_action='admin_retire' THEN
   UPDATE codes SET retired_reason='admin',review_note=p_data->>'reason',reviewed_at=now(),updated_at=now() WHERE id=c.id;
  ELSIF p_action='admin_restore' THEN
   IF c.retired_reason='replaced' THEN RAISE EXCEPTION 'LOCKED'; END IF;
   UPDATE codes SET moderation='approved',retired_reason=NULL,review_note=NULL,reviewed_at=now(),updated_at=now() WHERE id=c.id;
  ELSIF p_action='admin_resolve' THEN
   UPDATE codes SET moderation=CASE WHEN moderation='needs_review' THEN 'approved' ELSE moderation END,reviewed_at=now() WHERE id=c.id;
  ELSE RAISE EXCEPTION 'INVALID_ACTION'; END IF;
  UPDATE abuse_reports SET resolved_at=now() WHERE code_id=c.id AND resolved_at IS NULL;
  INSERT INTO admin_audit(actor,code_id,action,reason) VALUES(p_actor,c.id,p_action,p_data->>'reason');
  RETURN jsonb_build_object('ok',true);
 END IF;
 IF c.moderation NOT IN ('approved','needs_review') OR c.retired_reason IS NOT NULL OR c.remaining=0 THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 IF p_action='copy' THEN
  IF EXISTS(SELECT 1 FROM copy_gates WHERE code_id=c.id AND subject IN ('a:'||p_actor,'i:'||p_ip) AND last_counted_at>now()-interval '1 hour') THEN RETURN jsonb_build_object('counted',false); END IF;
  INSERT INTO copy_gates VALUES(c.id,'a:'||p_actor,now()) ON CONFLICT(code_id,subject) DO UPDATE SET last_counted_at=now();
  IF p_ip IS NOT NULL THEN INSERT INTO copy_gates VALUES(c.id,'i:'||p_ip,now()) ON CONFLICT(code_id,subject) DO UPDATE SET last_counted_at=now(); END IF;
  UPDATE codes SET copy_count=copy_count+1 WHERE id=c.id;
  INSERT INTO events(code_id,kind,actor_hash,ip_hash) VALUES(c.id,'copy',p_actor,p_ip);
  RETURN jsonb_build_object('counted',true);
 ELSIF p_action='report' THEN
  IF p_data->>'result' NOT IN ('success','fail') THEN RAISE EXCEPTION 'INVALID_ACTION'; END IF;
  SELECT * INTO f FROM feedback WHERE code_id=c.id AND actor_hash=p_actor;
  IF FOUND AND f.result=p_data->>'result' AND (f.result='success' OR f.observed_at>now()-interval '24 hours') THEN RETURN jsonb_build_object('changed',false); END IF;
  INSERT INTO feedback(code_id,actor_hash,result,ip_hash,eligible_for_status)
    VALUES(c.id,p_actor,p_data->>'result',p_ip,COALESCE((p_data->>'eligible')::boolean,true))
    ON CONFLICT(code_id,actor_hash) DO UPDATE SET result=excluded.result,ip_hash=excluded.ip_hash,
      eligible_for_status=excluded.eligible_for_status,observed_at=now();
  INSERT INTO events(code_id,kind,actor_hash,ip_hash) VALUES(c.id,'feedback_set',p_actor,p_ip);
  RETURN jsonb_build_object('changed',true);
 ELSIF p_action='abuse' THEN
  IF EXISTS(SELECT 1 FROM abuse_reports WHERE code_id=c.id AND actor_hash=p_actor AND created_at>now()-interval '24 hours') THEN RETURN jsonb_build_object('changed',false); END IF;
  INSERT INTO abuse_reports(code_id,actor_hash,ip_hash,reason,note) VALUES(c.id,p_actor,p_ip,p_data->>'reason',COALESCE(p_data->>'note',''));
  SELECT count(DISTINCT actor_hash),count(DISTINCT ip_hash) INTO n,ni FROM abuse_reports WHERE code_id=c.id AND resolved_at IS NULL;
  IF n>=5 AND ni>=5 THEN UPDATE codes SET moderation='needs_review' WHERE id=c.id; END IF;
  RETURN jsonb_build_object('changed',true);
 END IF;
 RAISE EXCEPTION 'INVALID_ACTION';
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION hub_cleanup() RETURNS void AS $$
BEGIN
 DELETE FROM events WHERE created_at<now()-interval '30 days';
 DELETE FROM copy_gates WHERE last_counted_at<now()-interval '1 day';
 DELETE FROM rate_gates WHERE NOT EXISTS(SELECT 1 FROM unnest(hits) t WHERE t>now()-interval '1 day');
 UPDATE feedback SET ip_hash=NULL WHERE ip_hash IS NOT NULL AND observed_at<now()-interval '30 days';
 UPDATE submissions SET ip_hash=NULL WHERE ip_hash IS NOT NULL AND created_at<now()-interval '30 days';
 DELETE FROM abuse_reports WHERE resolved_at<now()-interval '90 days';
 DELETE FROM admin_audit WHERE created_at<now()-interval '180 days';
 DELETE FROM admin_sessions WHERE expires_at<now()-interval '1 day' OR revoked_at<now()-interval '1 day';
 DELETE FROM feedback WHERE code_id IN (SELECT id FROM codes WHERE retired_reason IS NOT NULL AND updated_at<now()-interval '90 days');
 DELETE FROM codes WHERE moderation='pending' AND created_at<now()-interval '90 days';
 DELETE FROM submissions WHERE NOT EXISTS(SELECT 1 FROM codes WHERE submission_id=submissions.id);
END; $$ LANGUAGE plpgsql;
