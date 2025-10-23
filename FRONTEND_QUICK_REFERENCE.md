# Frontend Quick Reference Guide

## Project at a Glance

**Framework**: React 18.2  
**State Management**: React Query + Context API  
**Styling**: CSS with variables + Tailwind CSS  
**Routing**: React Router v6  
**API Client**: Axios with interceptors  
**Deployment**: Docker  

---

## Quick Navigation

### Main Entry Point
- **App.jsx** - Main component with all providers and routing
- **index.js** - React DOM render

### Key Directories

| Directory | Purpose | Key Files |
|-----------|---------|-----------|
| `/components` | UI components | 33 components across common, features, layout, ui |
| `/pages` | Route views | 16 page components |
| `/hooks` | Custom hooks | 14+ data/feature hooks |
| `/services` | Business logic | 12 API services |
| `/context` | Global state | AuthContext, ThemeContext |
| `/api` | API config | client.js, endpoints.js |
| `/utils` | Helper functions | formatters, validators, helpers |
| `/styles` | CSS files | Global and feature-specific |

---

## Data Flow Architecture

```
User Action
    ↓
Page Component
    ↓
Custom Hook (useSwap, useP2P, etc.)
    ↓
Service Layer (authService, swapService, etc.)
    ↓
API Client (axios with interceptors)
    ↓
Backend API
    ↓
Response → React Query Cache → Component Re-render
```

---

## State Management Strategy

### Global State (Across App)
- **Authentication**: `useAuth()` hook from AuthContext
- **Theme**: `useTheme()` hook from ThemeContext
- **Server Data**: React Query hooks (useQuery, useMutation)

### Local State (Component Level)
- Form inputs
- UI toggles (dropdowns, modals)
- Loading spinners
- Temporary calculations

### Example: Swap Feature
```javascript
// App level: Router + QueryClient + Auth/Theme providers

// Page level (Swap.jsx):
const { fromCrypto, toAmount, executeSwap } = useSwap();

// Hook level (useSwap.js):
- useState for local UI state
- useQuery for fetching cryptos/balances
- useMutation for executing swap
- useEffect for price calculations

// Service level (swapService.js):
- API calls to backend
- Response normalization
- Error handling
```

---

## Common Patterns

### 1. Fetching Data
```javascript
import { useQuery } from 'react-query';
import someService from '../services/someService';

const { data, isLoading, error } = useQuery(
  'queryKey',
  () => someService.fetchData(),
  { staleTime: 30000 }
);
```

### 2. Making API Calls
```javascript
import { useMutation } from 'react-query';
import someService from '../services/someService';

const mutation = useMutation(
  (data) => someService.updateData(data),
  {
    onSuccess: () => {
      // Refetch or update cache
      queryClient.invalidateQueries('queryKey');
    },
    onError: (error) => {
      toast.error(error.message);
    }
  }
);

// Use it
mutation.mutate(formData);
```

### 3. Protected Routes
```javascript
<Route
  path="/swap"
  element={
    <ProtectedRoute>
      <Swap />
    </ProtectedRoute>
  }
/>
```

### 4. Form Handling
```javascript
import { useForm } from 'react-hook-form';
import { validateEmail, validatePassword } from '../utils/validators';

const { register, handleSubmit, formState: { errors } } = useForm();

const onSubmit = async (data) => {
  // Submit to API
};

return (
  <form onSubmit={handleSubmit(onSubmit)}>
    <input {...register('email', { validate: validateEmail })} />
    {errors.email && <span>{errors.email.message}</span>}
  </form>
);
```

### 5. Error Handling
```javascript
import { toast } from 'react-hot-toast';

try {
  await someService.operation();
  toast.success('Success!');
} catch (error) {
  const message = error.response?.data?.error || error.message;
  toast.error(message);
}
```

### 6. Toast Notifications
```javascript
import { toast } from 'react-hot-toast';

toast.success('Operation successful');
toast.error('Something went wrong');
toast.loading('Processing...');
```

---

## API Endpoints Reference

### Authentication
- POST `/usuario/login` - Login
- POST `/usuario/register` - Register
- POST `/usuario/verify-2fa` - Verify 2FA
- GET `/usuario/me` - Get profile
- GET `/usuario/search?q=email` - Search user
- PATCH `/usuario/me/change-password` - Change password
- PATCH `/usuario/me/2fa-toggle` - Toggle 2FA

### Trading (Swap)
- GET `/parExchange/symbols/{base}/{quote}` - Get exchange pair
- GET `/parExchange/price/{base}/{quote}` - Get price
- POST `/intercambioExchange/calculate` - Calculate swap
- POST `/intercambioExchange/` - Execute swap
- POST `/intercambioExchange/check-limit` - Check limit

### Wallet
- GET `/balances/my/balances` - Get balances
- GET `/criptomoneda/public/active` - Get active cryptos
- GET `/direccionDeposito/user/me/crypto/{cryptoId}` - Deposit address
- POST `/transactions/withdraw` - Create withdrawal

### Transfers
- POST `/transferencia` - Create transfer
- GET `/transferencia/my` - My transfers
- POST `/transferencia/verify-funds` - Verify funds
- POST `/transferencia/{id}/process` - Process transfer

### P2P
- GET `/ofertaP2P` - Get offers
- GET `/ofertaP2P/me/ofertas` - My offers
- POST `/ofertaP2P` - Create offer
- PATCH `/ofertaP2P/{id}/toggle` - Toggle offer
- PATCH `/transaccionP2P/{id}/confirm-payment` - Confirm payment
- PATCH `/transaccionP2P/{id}/complete` - Release cryptos
- PATCH `/transaccionP2P/{id}/cancel` - Cancel transaction

### Notifications
- GET `/notificaciones/me` - Get notifications
- GET `/notificaciones/me/unread-count` - Unread count
- PATCH `/notificaciones/me/mark-all-read` - Mark all read
- PATCH `/notificaciones/me/{id}/mark-read` - Mark as read

---

## Key Files to Know

### Authentication Flow
- **Entry**: `src/pages/Login.jsx` or `src/pages/Register.jsx`
- **Context**: `src/context/AuthContext.jsx`
- **Service**: `src/services/authService.js`
- **Hooks**: `src/hooks/useLoginFlow.js`, `useRegister.js`
- **Utils**: `src/utils/validators.js`

### Swap Feature
- **Page**: `src/pages/Swap.jsx`
- **Hook**: `src/hooks/useSwap.js` (260+ lines, complete logic)
- **Service**: `src/services/swapService.js`
- **Component**: `src/components/features/SwapConfirmModal.jsx`
- **Styles**: `src/styles/Swap.css`

### P2P Trading
- **Pages**: `src/pages/P2PMarketplace.jsx`, `CrearOfertaP2P.jsx`, `P2PMisOfertas.jsx`
- **Hook**: `src/hooks/useP2P.js`
- **Service**: `src/services/p2pService.js`
- **Components**: `src/components/features/p2p/*`

### Transfers
- **Page**: `src/pages/Transferencia.jsx`
- **Hook**: `src/hooks/useTransfers.js`
- **Service**: `src/services/transferService.js`
- **Component**: `src/components/features/TransferForm.jsx`
- **Utils**: `src/utils/formatters.js` (PDF generation)

---

## Environment Configuration

### .env Variables
```
REACT_APP_API_URL=http://backend:3001
```

### Build Configs
- `craco.config.js` - Hot reload and webpack config
- `package.json` - Dependencies and scripts
- `public/index.html` - HTML template

---

## Adding a New Feature (Step-by-Step)

### 1. Create API Service
```javascript
// src/services/featureService.js
class FeatureService {
  async getFeatureData() {
    const response = await apiClient.get(ENDPOINTS.FEATURE_DATA);
    return response.data?.data || response.data;
  }
}
export default new FeatureService();
```

### 2. Create Custom Hook
```javascript
// src/hooks/useFeature.js
import { useQuery } from 'react-query';
import featureService from '../services/featureService';

export const useFeature = () => {
  const { data, isLoading, error } = useQuery(
    'featureData',
    () => featureService.getFeatureData()
  );
  return { data, isLoading, error };
};
```

### 3. Create Page Component
```javascript
// src/pages/Feature.jsx
import { useFeature } from '../hooks/useFeature';

const Feature = () => {
  const { data, isLoading } = useFeature();
  
  if (isLoading) return <LoadingSpinner />;
  
  return <div>{/* Feature JSX */}</div>;
};
export default Feature;
```

### 4. Add Route
```javascript
// src/App.jsx
<Route path="feature" element={<ProtectedRoute><Feature /></ProtectedRoute>} />
```

### 5. Add Endpoint
```javascript
// src/api/endpoints.js
FEATURE_DATA: '/feature',
```

---

## Debugging Tips

### Console Logging
- Most services and hooks have detailed logging
- Look for emojis: 🔐, ✅, ❌, 📝, 💰, etc.
- Search console for feature name

### React Query DevTools
- Install `@tanstack/react-query-devtools`
- Import and add to App.jsx
- See all queries, cache, timing

### Browser DevTools
- React Profiler - check rendering performance
- Network tab - inspect API calls
- Storage - check localStorage (token, theme)

---

## Performance Notes

- **Stale Time**: 30 seconds (data considered fresh for 30s)
- **No Window Focus Refetch**: Reduces unnecessary API calls
- **Debounce**: 500ms for price calculations in Swap
- **Skeleton Loaders**: Used instead of spinners for data loading
- **Pagination**: Market data loads in pages

---

## Testing Checklist

### Authentication
- [ ] Login with email/password
- [ ] Login with Google
- [ ] 2FA verification
- [ ] Session persistence (refresh page)
- [ ] Logout clears token

### Trading
- [ ] Swap with different cryptos
- [ ] P2P create/accept/cancel offers
- [ ] Insufficient balance error

### User Data
- [ ] View balances
- [ ] Create transfer
- [ ] View notifications
- [ ] Change password

### UI/UX
- [ ] Theme switching works
- [ ] Mobile responsive
- [ ] Error messages clear
- [ ] Loading states appear

---

## Deployment

### Production Build
```bash
npm run build
# Creates /build folder
```

### Docker
```bash
docker build -f Dockerfile -t crypto-frontend .
docker run -p 3000:80 crypto-frontend
```

### Environment Variables (Production)
Set `REACT_APP_API_URL` to production backend URL

---

## File Size Guide

**Largest Components**:
- `useSwap.js` - 260+ lines
- `useAdmin.js` - 300+ lines
- `Navbar.jsx` - 300+ lines
- `SuperAdmin.jsx` - 500+ lines

**Most Used Patterns**:
- Service singleton pattern
- Custom hooks with React Query
- Protected route wrapper
- Toast notifications

