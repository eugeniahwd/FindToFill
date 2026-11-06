import { reportService } from '@/lib/services/reportService';

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
});

function respond(status: number, body: unknown) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body } as Response);
}

describe('reportService.createReport (browser)', () => {
  it('sends multipart form data with the compressed photo and no user id', async () => {
    fetchMock.mockReturnValue(respond(201, { report: { id: 'r1' }, stampAwarded: true }));
    const result = await reportService.createReport({
      facilityId: 'f1',
      userId: 'someone-else',
      status: 'empty',
      note: '  Galon habis  ',
      photoUrl: `data:image/jpeg;base64,${btoa('\xff\xd8\xff\xe0')}`,
    });

    expect(result).toEqual({ report: { id: 'r1' }, stampAwarded: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/reports');
    expect(init.method).toBe('POST');
    const form = init.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect(form.get('facilityId')).toBe('f1');
    expect(form.get('status')).toBe('empty');
    expect(form.get('note')).toBe('Galon habis');
    expect(form.get('userId')).toBeNull();
    expect((form.get('photo') as Blob).type).toBe('image/jpeg');
    // multipart: the browser must set Content-Type (with boundary) itself
    expect(init.headers).toBeUndefined();
  });

  it('omits an empty note', async () => {
    fetchMock.mockReturnValue(respond(201, { report: { id: 'r1' }, stampAwarded: false }));
    await reportService.createReport({
      facilityId: 'f1',
      status: 'available',
      note: '   ',
      photoUrl: `data:image/jpeg;base64,${btoa('\xff\xd8\xff')}`,
    });
    expect((fetchMock.mock.calls[0][1].body as FormData).get('note')).toBeNull();
  });

  it('surfaces the API error code (e.g. rate limit)', async () => {
    fetchMock.mockReturnValue(respond(429, { error: { code: 'RATE_LIMITED', message: 'Limit reached.' } }));
    await expect(
      reportService.createReport({ facilityId: 'f1', status: 'empty', photoUrl: `data:image/jpeg;base64,${btoa('x')}` }),
    ).rejects.toMatchObject({ status: 429, code: 'RATE_LIMITED' });
  });
});
