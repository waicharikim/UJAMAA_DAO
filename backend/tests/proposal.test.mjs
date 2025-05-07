import request from 'supertest';
import express from 'express';
import proposalRoutes from '../src/routes/proposal';
const app = express();
app.use(express.json());
app.use('/api/proposals', proposalRoutes);
describe('Proposal API Tests', () => {
    it('rejects creation with missing fields', async () => {
        const res = await request(app).post('/api/proposals/create').send({});
        expect(res.statusCode).toBe(400);
        expect(res.body.success).toBe(false);
    });
    it('creates proposal with valid fields', async () => {
        const validProposal = {
            creatorGroupId: 'dummy-group-uuid',
            proposalType: 'Business',
            funded: true,
            title: 'Test Proposal',
            description: 'Testing proposal creation',
            budget: 10000,
            locationScope: 'Local',
            constituency: 'Nairobi West',
            county: 'Nairobi',
            purposeDetails: {
                businessModel: 'Sell services',
                profitProjection: '10k/year',
                communityBenefit: 'Jobs',
            },
        };
        const res = await request(app).post('/api/proposals/create').send(validProposal);
        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.proposalId).toBeDefined();
    });
    it('fetches proposal details', async () => {
        const res = await request(app).get('/api/proposals/dummy-uuid');
        expect(res.statusCode).toBe(200);
        expect(res.body.proposalId).toBe('dummy-uuid');
    });
    it('returns 404 for unknown proposal', async () => {
        const res = await request(app).get('/api/proposals/unknown-uuid');
        expect(res.statusCode).toBe(404);
    });
    it('updates proposal status', async () => {
        const res = await request(app).patch('/api/proposals/dummy-uuid').send({ status: 'Voting' });
        expect(res.statusCode).toBe(200);
        expect(res.body.updatedStatus).toBe('Voting');
    });
});
//# sourceMappingURL=proposal.test.mjs.map