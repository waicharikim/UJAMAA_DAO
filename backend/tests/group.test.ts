import request from 'supertest';
import express from 'express';
import groupRoutes from '../src/routes/group';

const app = express();
app.use(express.json());
app.use('/api/groups', groupRoutes);

describe('Group routes', () => {
  it('should require required fields on create', async () => {
    const res = await request(app).post('/api/groups/create').send({});
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should create group with valid data', async () => {
    const res = await request(app)
      .post('/api/groups/create')
      .send({
        name: 'Test Group',
        walletAddress: '0x123abc456def7890abcdef1234567890abcdef12',
        constituency: 'Nairobi West',
        county: 'Nairobi',
      });
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('should add user to group', async () => {
    const res = await request(app).post('/api/groups/join').send({
      groupId: 'dummy-uuid',
      userId: 'user-uuid',
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should fetch group details or 404', async () => {
    const res = await request(app).get('/api/groups/dummy-uuid');
    expect(res.statusCode).toBe(200);
    expect(res.body.name).toBeDefined();

    const resNotFound = await request(app).get('/api/groups/nonexistent');
    expect(resNotFound.statusCode).toBe(404);
  });
});