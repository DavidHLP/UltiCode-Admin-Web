import { requestData } from '@/utils/request';
import { LoginPayload, AuthResponse, BASE_URL } from './auth';


export function login(payload: LoginPayload) {
return requestData<AuthResponse>({
config: {
url: `${BASE_URL}/login`,
method: 'POST',
data: payload,
}
});
}
