import * as Sentry from '@sentry/react-native';
Sentry.init({ dsn: 'https://x@o0.ingest.sentry.io/0', sendDefaultPii: false, beforeSend: scrub, beforeBreadcrumb: scrubCrumb });
