
# Deployment Checklist

## Pre-Deployment

### 1. Code Quality
- [ ] All tests passing
- [ ] No console.errors in production code
- [ ] TypeScript compilation clean
- [ ] ESLint warnings resolved
- [ ] Dependencies updated

### 2. Configuration
- [ ] Environment variables set
- [ ] Database migrations run
- [ ] Secrets configured in Replit
- [ ] Port set to 5000
- [ ] NODE_ENV=production

### 3. Database
- [ ] Migrations tested
- [ ] Seed data loaded
- [ ] Backups configured
- [ ] Connection pool sized correctly
- [ ] Indexes optimized

### 4. Performance
- [ ] API response times < 200ms
- [ ] Database queries optimized
- [ ] Caching enabled
- [ ] Rate limiting configured
- [ ] Memory usage monitored

### 5. Security
- [ ] API keys in Secrets
- [ ] CORS configured
- [ ] Helmet.js enabled
- [ ] Rate limiting active
- [ ] Input validation implemented

### 6. Monitoring
- [ ] Error logging enabled
- [ ] Health checks working
- [ ] Metrics collection active
- [ ] Alerts configured
- [ ] Log rotation setup

## Deployment Steps

### 1. Build Application
```bash
npm run build
```

### 2. Run Database Migrations
```bash
npm run db:migrate
```

### 3. Start Server
```bash
npm run start
```

### 4. Verify Health
```bash
curl https://your-repl.replit.app/api/health
```

## Post-Deployment

### 1. Smoke Tests
- [ ] Homepage loads
- [ ] API endpoints respond
- [ ] WebSocket connects
- [ ] Database queries work
- [ ] Authentication works

### 2. Monitoring
- [ ] Check error logs
- [ ] Monitor response times
- [ ] Watch memory usage
- [ ] Verify data updates
- [ ] Test user flows

### 3. Rollback Plan
```bash
# If issues occur:
git revert HEAD
npm run build
pm2 restart all
```

## Replit Deployment

### Configuration
Update `.replit`:
```toml
[deployment]
deploymentTarget = "autoscale"
run = ["npm", "run", "start"]
build = ["npm", "run", "build"]
```

### Deploy
1. Click "Deploy" button in Replit
2. Wait for build to complete
3. Test deployment URL
4. Monitor logs

## Monitoring Checklist

### Daily
- [ ] Check error rates
- [ ] Review slow queries
- [ ] Monitor uptime
- [ ] Check disk space

### Weekly
- [ ] Review performance metrics
- [ ] Update dependencies
- [ ] Backup database
- [ ] Check security alerts

### Monthly
- [ ] Performance review
- [ ] Cost analysis
- [ ] Capacity planning
- [ ] Security audit
