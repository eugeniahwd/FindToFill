import { FakeDataProvider } from '@/lib/chatbot/data/fakeProvider';
import { runProviderContractTests } from './provider.contract';

runProviderContractTests('FakeDataProvider', (seed) => new FakeDataProvider(seed));
