# Frontend Integration Guide - Adidas Jersey Store

## 🔗 API Integration Overview

Your backend exposes **13 endpoints** across 3 resource types. Here's exactly what your frontend should request and expect.

---

## 📡 Base API Configuration

### Setup API Client

**File:** `src/api/client.js` (or `apiClient.ts`)

```javascript
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for debugging
apiClient.interceptors.request.use(
  (config) => {
    console.log(`[API] ${config.method.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    console.log(`[API] Response:`, response.data);
    return response.data; // Return only the data object
  },
  (error) => {
    console.error('[API Error]', error.response?.data || error.message);
    return Promise.reject(error.response?.data || error);
  }
);

export default apiClient;
```

**File:** `.env.local`

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

---

## 🎯 Request/Response Pattern

### All Responses Follow This Structure

```typescript
// Success response
{
  success: true,
  data: {} | [],
  pagination?: {
    page: number,
    limit: number,
    total: number
  }
}

// Error response
{
  success: false,
  error: string,
  details?: {
    field: string,
    message: string
  }[]
}
```

### HTTP Status Codes

| Code | Meaning | When |
|------|---------|------|
| 200 | OK | GET, PUT, DELETE successful |
| 201 | Created | POST successful |
| 400 | Bad Request | Validation failed |
| 404 | Not Found | Resource doesn't exist |
| 500 | Internal Error | Server error |

---

## 🎯 Redux Toolkit Setup

### Redux State Shape

```javascript
// File: src/store/store.js
import { configureStore } from '@reduxjs/toolkit';
import leaguesReducer from './slices/leaguesSlice';
import clubsReducer from './slices/clubsSlice';
import jerseysReducer from './slices/jerseysSlice';
import filtersReducer from './slices/filtersSlice';
import cartReducer from './slices/cartSlice';

export const store = configureStore({
  reducer: {
    leagues: leaguesReducer,
    clubs: clubsReducer,
    jerseys: jerseysReducer,
    filters: filtersReducer,
    cart: cartReducer,
  },
});

export default store;
```

### Sample Redux Slice Structure

```javascript
// File: src/store/slices/jerseysSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiClient from '../../api/client';

// Async thunks
export const fetchJerseys = createAsyncThunk(
  'jerseys/fetchJerseys',
  async (params, { rejectWithValue }) => {
    try {
      const response = await apiClient.get('/jerseys', { params });
      return response; // { success, data, pagination }
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const fetchJerseyById = createAsyncThunk(
  'jerseys/fetchJerseyById',
  async (id, { rejectWithValue }) => {
    try {
      const response = await apiClient.get(`/jerseys/${id}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const createJersey = createAsyncThunk(
  'jerseys/createJersey',
  async (jerseyData, { rejectWithValue }) => {
    try {
      const response = await apiClient.post('/jerseys', jerseyData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const updateJersey = createAsyncThunk(
  'jerseys/updateJersey',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await apiClient.put(`/jerseys/${id}`, data);
      return response.data;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const deleteJersey = createAsyncThunk(
  'jerseys/deleteJersey',
  async (id, { rejectWithValue }) => {
    try {
      await apiClient.delete(`/jerseys/${id}`);
      return id; // Return the deleted ID
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

// Slice
const initialState = {
  items: [],
  selectedJersey: null,
  loading: false,
  error: null,
  pagination: { page: 1, limit: 20, total: 0 },
};

const jerseysSlice = createSlice({
  name: 'jerseys',
  initialState,
  reducers: {
    clearSelectedJersey: (state) => {
      state.selectedJersey = null;
    },
  },
  extraReducers: (builder) => {
    // fetchJerseys
    builder
      .addCase(fetchJerseys.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchJerseys.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.data;
        state.pagination = action.payload.pagination || {};
      })
      .addCase(fetchJerseys.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.error || 'Failed to fetch jerseys';
      });

    // fetchJerseyById
    builder
      .addCase(fetchJerseyById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchJerseyById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedJersey = action.payload;
      })
      .addCase(fetchJerseyById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.error || 'Failed to fetch jersey';
      });

    // createJersey
    builder
      .addCase(createJersey.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createJersey.fulfilled, (state, action) => {
        state.loading = false;
        state.items.unshift(action.payload);
      })
      .addCase(createJersey.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.error || 'Failed to create jersey';
      });

    // updateJersey
    builder
      .addCase(updateJersey.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateJersey.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.items.findIndex((j) => j.jersey_id === action.payload.jersey_id);
        if (index !== -1) state.items[index] = action.payload;
        if (state.selectedJersey?.jersey_id === action.payload.jersey_id) {
          state.selectedJersey = action.payload;
        }
      })
      .addCase(updateJersey.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.error || 'Failed to update jersey';
      });

    // deleteJersey
    builder
      .addCase(deleteJersey.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteJersey.fulfilled, (state, action) => {
        state.loading = false;
        state.items = state.items.filter((j) => j.jersey_id !== action.payload);
      })
      .addCase(deleteJersey.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.error || 'Failed to delete jersey';
      });
  },
});

export const { clearSelectedJersey } = jerseysSlice.actions;
export default jerseysSlice.reducer;
```

---

## 🎣 Custom Hooks for API Calls

### useJerseys Hook

```javascript
// File: src/hooks/useJerseys.js
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchJerseys } from '../store/slices/jerseysSlice';

export const useJerseys = (filters = {}) => {
  const dispatch = useDispatch();
  const { items, loading, error, pagination } = useSelector((state) => state.jerseys);

  useEffect(() => {
    dispatch(fetchJerseys(filters));
  }, [dispatch, JSON.stringify(filters)]);

  return { jerseys: items, loading, error, pagination };
};
```

### useJerseyDetail Hook

```javascript
// File: src/hooks/useJerseyDetail.js
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchJerseyById } from '../store/slices/jerseysSlice';

export const useJerseyDetail = (jerseyId) => {
  const dispatch = useDispatch();
  const { selectedJersey, loading, error } = useSelector((state) => state.jerseys);

  useEffect(() => {
    if (jerseyId) {
      dispatch(fetchJerseyById(jerseyId));
    }
  }, [dispatch, jerseyId]);

  return { jersey: selectedJersey, loading, error };
};
```

---

## 📊 API Endpoint Details

### LEAGUES - 4 Endpoints

#### 1. GET /api/leagues (List)

**Request:**
```javascript
// In component with Redux
const { jerseys, loading } = useDispatch(fetchJerseys({
  page: 1,
  limit: 20
}));

// Custom URL params
const params = {
  page: currentPage,
  limit: 20,
};
const response = await apiClient.get('/leagues', { params });
```

**Expected Response:**
```javascript
{
  success: true,
  data: [
    {
      league_id: 1,
      league_name: "Premier League",
      short_code: "EPL",
      country: "England",
      confederation: "UEFA",
      tier: 1,
      adidas_partner: true,
      created_at: "2024-03-03T10:00:00Z"
    },
    // ... more leagues
  ],
  pagination: {
    page: 1,
    limit: 20,
    total: 5
  }
}
```

**Redux Handling:**
```javascript
const dispatch = useDispatch();
const { items: leagues, loading, pagination } = useSelector(state => state.leagues);

// Dispatch
dispatch(fetchLeagues({ page: 1, limit: 20 }));

// In JSX
{loading ? <Loader /> : (
  <div>
    {leagues.map(league => <LeagueCard key={league.league_id} league={league} />)}
    <Pagination current={pagination.page} total={pagination.total} />
  </div>
)}
```

---

#### 2. GET /api/leagues/:id (Detail)

**Request:**
```javascript
const response = await apiClient.get(`/leagues/${leagueId}`);
// response.data = { league_id, league_name, ... }
```

**Expected Response:**
```javascript
{
  success: true,
  data: {
    league_id: 1,
    league_name: "Premier League",
    short_code: "EPL",
    country: "England",
    confederation: "UEFA",
    tier: 1,
    adidas_partner: true,
    created_at: "2024-03-03T10:00:00Z"
  }
}
```

---

#### 3. GET /api/leagues/:id/clubs (Clubs in League)

**Request:**
```javascript
const response = await apiClient.get(`/leagues/${leagueId}/clubs`, {
  params: { page: 1, limit: 20 }
});
```

**Expected Response:**
```javascript
{
  success: true,
  data: [
    {
      club_id: 1,
      league_id: 1,
      club_name: "Arsenal",
      short_name: "ARS",
      founded_year: 1886,
      city: "London",
      country: "England",
      primary_color: "#EF0107",
      secondary_color: "#FFFFFF",
      adidas_partner: true,
      created_at: "2024-03-03T10:00:00Z"
    }
  ],
  pagination: { page: 1, limit: 20, total: 4 }
}
```

---

#### 4. GET /api/leagues/:id/jerseys (Jerseys in League)

**Request:**
```javascript
const response = await apiClient.get(`/leagues/${leagueId}/jerseys`, {
  params: { page: 1, limit: 20 }
});
```

**Expected Response:**
```javascript
{
  success: true,
  data: [
    {
      jersey_id: 1,
      club_id: 1,
      league_id: 1,
      product_code: "AR6001",
      season: "2024/25",
      jersey_type: "home",
      name: "Arsenal Home Jersey 2024/25",
      price_usd: "120.00",
      technology: "HEAT.RDY",
      in_stock: true,
      release_date: "2024-06-15",
      created_at: "2024-03-03T10:00:00Z",
      club_name: "Arsenal",
      short_name: "ARS",
      city: "London",
      league_name: "Premier League",
      short_code: "EPL"
    }
  ],
  pagination: { page: 1, limit: 20, total: 12 }
}
```

---

### CLUBS - 3 Endpoints

#### 1. GET /api/clubs (List with optional league filter)

**Request:**
```javascript
// No filter
const response = await apiClient.get('/clubs', { params: { page: 1, limit: 20 } });

// With league filter
const response = await apiClient.get('/clubs', {
  params: {
    league_id: 1,
    page: 1,
    limit: 20
  }
});
```

**Expected Response:**
```javascript
{
  success: true,
  data: [
    {
      club_id: 1,
      league_id: 1,
      club_name: "Arsenal",
      short_name: "ARS",
      founded_year: 1886,
      city: "London",
      country: "England",
      primary_color: "#EF0107",
      secondary_color: "#FFFFFF",
      adidas_partner: true,
      created_at: "2024-03-03T10:00:00Z"
    }
  ],
  pagination: { page: 1, limit: 20, total: 14 }
}
```

---

#### 2. GET /api/clubs/:id (Detail)

**Request:**
```javascript
const response = await apiClient.get(`/clubs/${clubId}`);
```

**Expected Response:**
```javascript
{
  success: true,
  data: {
    club_id: 1,
    league_id: 1,
    club_name: "Arsenal",
    short_name: "ARS",
    founded_year: 1886,
    city: "London",
    country: "England",
    primary_color: "#EF0107",
    secondary_color: "#FFFFFF",
    adidas_partner: true,
    created_at: "2024-03-03T10:00:00Z",
    league_name: "Premier League",
    short_code: "EPL",
    confederation: "UEFA"
  }
}
```

---

#### 3. GET /api/clubs/:id/jerseys (Jerseys in Club)

**Request:**
```javascript
const response = await apiClient.get(`/clubs/${clubId}/jerseys`, {
  params: { page: 1, limit: 20 }
});
```

**Expected Response:**
```javascript
{
  success: true,
  data: [
    {
      jersey_id: 1,
      club_id: 1,
      league_id: 1,
      product_code: "AR6001",
      season: "2024/25",
      jersey_type: "home",
      name: "Arsenal Home Jersey 2024/25",
      price_usd: "120.00",
      technology: "HEAT.RDY",
      in_stock: true,
      release_date: "2024-06-15",
      created_at: "2024-03-03T10:00:00Z",
      club_name: "Arsenal",
      short_name: "ARS",
      league_name: "Premier League"
    }
  ],
  pagination: { page: 1, limit: 20, total: 3 }
}
```

---

### JERSEYS - 5 Endpoints (Full CRUD)

#### 1. GET /api/jerseys (List with advanced filters)

**Request with ALL filters:**
```javascript
const response = await apiClient.get('/jerseys', {
  params: {
    club_id: 1,           // Filter by club
    league_id: 1,         // Filter by league
    type: 'home',         // home | away | third | goalkeeper
    season: '2024/25',    // Format: YYYY/YY
    in_stock: true,       // true | false
    page: 1,              // Default 1
    limit: 20             // Default 20, max 100
  }
});
```

**Expected Response:**
```javascript
{
  success: true,
  data: [
    {
      jersey_id: 1,
      club_id: 1,
      league_id: 1,
      product_code: "AR6001",
      season: "2024/25",
      jersey_type: "home",
      name: "Arsenal Home Jersey 2024/25",
      price_usd: "120.00",
      technology: "HEAT.RDY",
      in_stock: true,
      release_date: "2024-06-15",
      created_at: "2024-03-03T10:00:00Z"
    }
  ],
  pagination: { page: 1, limit: 20, total: 40 }
}
```

**Redux Usage Example:**
```javascript
// In component
const dispatch = useDispatch();
const { jerseys, loading, pagination } = useSelector(state => state.jerseys);

const handleFilterChange = (filters) => {
  dispatch(fetchJerseys({
    club_id: filters.clubId,
    league_id: filters.leagueId,
    type: filters.jerseyType,
    season: filters.season,
    in_stock: filters.inStock,
    page: filters.page || 1,
    limit: filters.limit || 20
  }));
};

// JSX
<JerseyGrid jerseys={jerseys} loading={loading} />
<Pagination pagination={pagination} onPageChange={handleFilterChange} />
```

---

#### 2. GET /api/jerseys/:id (Detail)

**Request:**
```javascript
const response = await apiClient.get(`/jerseys/${jerseyId}`);
```

**Expected Response:**
```javascript
{
  success: true,
  data: {
    jersey_id: 1,
    club_id: 1,
    league_id: 1,
    product_code: "AR6001",
    season: "2024/25",
    jersey_type: "home",
    name: "Arsenal Home Jersey 2024/25",
    price_usd: "120.00",
    technology: "HEAT.RDY",
    in_stock: true,
    release_date: "2024-06-15",
    created_at: "2024-03-03T10:00:00Z",
    club_name: "Arsenal",
    short_name: "ARS",
    city: "London",
    primary_color: "#EF0107",
    secondary_color: "#FFFFFF",
    league_name: "Premier League",
    short_code: "EPL"
  }
}
```

---

#### 3. POST /api/jerseys (Create - Admin)

**Request Body:**
```javascript
const jerseyData = {
  club_id: 1,                          // Required: integer
  league_id: 1,                        // Required: integer
  product_code: "AR6004",              // Required: 5-20 chars, no spaces
  season: "2024/25",                   // Required: YYYY/YY format
  jersey_type: "goalkeeper",           // Required: home|away|third|goalkeeper
  name: "Arsenal Goalkeeper Jersey",   // Required: max 150 chars
  price_usd: 125,                      // Required: 1-999 (number, not string)
  technology: "AEROREADY",             // Optional: max 50 chars
  in_stock: true,                      // Optional: boolean (default true)
  release_date: "2024-07-01"           // Optional: ISO date string
};

const response = await apiClient.post('/jerseys', jerseyData);
```

**Expected Response (201 Created):**
```javascript
{
  success: true,
  data: {
    jersey_id: 42,
    club_id: 1,
    league_id: 1,
    product_code: "AR6004",
    season: "2024/25",
    jersey_type: "goalkeeper",
    name: "Arsenal Goalkeeper Jersey",
    price_usd: "125.00",
    technology: "AEROREADY",
    in_stock: true,
    release_date: "2024-07-01",
    created_at: "2024-03-03T10:00:00Z"
  }
}
```

**Error Response (400 Validation Error):**
```javascript
{
  success: false,
  error: "Validation failed",
  details: [
    {
      field: "product_code",
      message: "product_code must be 5-20 characters"
    },
    {
      field: "price_usd",
      message: "price_usd must be between 1 and 999"
    }
  ]
}
```

**Redux Form Handler:**
```javascript
const handleCreateJersey = async (formData) => {
  try {
    const result = await dispatch(createJersey(formData)).unwrap();
    toast.success('Jersey created!');
    navigate(`/jerseys/${result.jersey_id}`);
  } catch (error) {
    // error.details contains field-level validation errors
    setFormErrors(error.details || []);
    toast.error(error.error || 'Creation failed');
  }
};
```

---

#### 4. PUT /api/jerseys/:id (Update - All fields optional)

**Request Body (partial update example):**
```javascript
const updateData = {
  price_usd: 130,           // Optional: partial update
  in_stock: false,          // Optional
  technology: "HEAT.RDY"    // Optional
  // Only changed fields needed!
};

const response = await apiClient.put(`/jerseys/${jerseyId}`, updateData);
```

**Expected Response (200 OK):**
```javascript
{
  success: true,
  data: {
    jersey_id: 1,
    club_id: 1,
    league_id: 1,
    product_code: "AR6001",
    season: "2024/25",
    jersey_type: "home",
    name: "Arsenal Home Jersey 2024/25",
    price_usd: "130.00",      // Updated
    technology: "HEAT.RDY",   // Updated
    in_stock: false,          // Updated
    release_date: "2024-06-15",
    created_at: "2024-03-03T10:00:00Z"
  }
}
```

**Redux Async Thunk:**
```javascript
const handleUpdateJersey = async (jerseyId, updates) => {
  try {
    const result = await dispatch(
      updateJersey({ id: jerseyId, data: updates })
    ).unwrap();
    toast.success('Jersey updated!');
  } catch (error) {
    setFormErrors(error.details || []);
    toast.error(error.error || 'Update failed');
  }
};
```

---

#### 5. DELETE /api/jerseys/:id (Delete)

**Request:**
```javascript
const response = await apiClient.delete(`/jerseys/${jerseyId}`);
```

**Expected Response (200 OK):**
```javascript
{
  success: true,
  data: {
    jersey_id: 1
  }
}
```

**Error Response (404 Not Found):**
```javascript
{
  success: false,
  error: "Not found"
}
```

**Redux Handler:**
```javascript
const handleDeleteJersey = async (jerseyId) => {
  if (!confirm('Delete this jersey?')) return;
  
  try {
    await dispatch(deleteJersey(jerseyId)).unwrap();
    toast.success('Jersey deleted!');
    navigate('/jerseys');
  } catch (error) {
    toast.error(error.error || 'Deletion failed');
  }
};
```

---

## 🔄 Pagination Pattern

**All list endpoints support pagination:**

```javascript
// Request
const params = {
  page: 2,      // Current page (1-indexed)
  limit: 20     // Items per page
};

// Response includes
{
  pagination: {
    page: 2,
    limit: 20,
    total: 145    // Total number of items
  }
}
```

**Calculate total pages:**
```javascript
const totalPages = Math.ceil(pagination.total / pagination.limit);

// Usage in pagination component
<button disabled={pagination.page >= totalPages}>Next</button>
```

---

## 🔎 Search & Filter Patterns

### Jersey Search (Most Complex)

```javascript
const [filters, setFilters] = useState({
  club_id: null,
  league_id: null,
  type: null,
  season: null,
  in_stock: null,
  page: 1,
  limit: 20
});

const handleFilterChange = (newFilters) => {
  setFilters(prev => ({
    ...prev,
    ...newFilters,
    page: 1  // Reset to page 1 when filters change
  }));
};

// Dispatch Redux action with filters
useEffect(() => {
  dispatch(fetchJerseys(filters));
}, [filters, dispatch]);
```

**Filter Examples:**

```javascript
// Filter: Home jerseys only
dispatch(fetchJerseys({ type: 'home' }));

// Filter: In stock items from Premier League
dispatch(fetchJerseys({ league_id: 1, in_stock: true }));

// Filter: All away jerseys in 2024/25 season
dispatch(fetchJerseys({ type: 'away', season: '2024/25' }));

// Filter: Specific club's all jerseys (useful for club detail page)
dispatch(fetchJerseys({ club_id: 1 }));
```

---

## ⚠️ Error Handling

### Standard Error Format

```javascript
{
  success: false,
  error: "Human-readable error message",
  details?: [
    { field: "product_code", message: "5-20 characters required" },
    { field: "price_usd", message: "Must be 1-999" }
  ]
}
```

### Component Error Handling

```javascript
const { jerseys, loading, error } = useJerseys(filters);

if (error) {
  return (
    <ErrorBoundary>
      <p className="text-red-500">{error}</p>
      <button onClick={() => dispatch(fetchJerseys(filters))}>
        Retry
      </button>
    </ErrorBoundary>
  );
}
```

### Form Field Errors

```javascript
import { useForm } from 'react-hook-form';

const { register, handleSubmit, formState: { errors }, setError } = useForm();

const onSubmit = async (data) => {
  try {
    await dispatch(createJersey(data)).unwrap();
  } catch (error) {
    // Set field-level errors from API
    error.details?.forEach(({ field, message }) => {
      setError(field, { type: 'manual', message });
    });
  }
};

// In JSX
<input {...register('product_code')} />
{errors.product_code && <span>{errors.product_code.message}</span>}
```

---

## 🎯 Component Integration Examples

### Jersey List Component with Filters

```javascript
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchJerseys } from '../store/slices/jerseysSlice';

export const JerseyShop = () => {
  const dispatch = useDispatch();
  const { items: jerseys, loading, error, pagination } = useSelector(
    state => state.jerseys
  );
  
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    club_id: null,
    league_id: null,
    type: null,
    season: null,
    in_stock: null
  });

  useEffect(() => {
    // Build params object (only include non-null values)
    const params = Object.fromEntries(
      Object.entries(filters).filter(([_, v]) => v !== null)
    );
    dispatch(fetchJerseys(params));
  }, [filters, dispatch]);

  const handlePageChange = (newPage) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  const handleTypeFilter = (type) => {
    setFilters(prev => ({
      ...prev,
      type: prev.type === type ? null : type,
      page: 1
    }));
  };

  if (loading) return <div>Loading jerseys...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="shops-page">
      <div className="filters">
        <button onClick={() => handleTypeFilter('home')}>
          Home {filters.type === 'home' && '✓'}
        </button>
        <button onClick={() => handleTypeFilter('away')}>
          Away {filters.type === 'away' && '✓'}
        </button>
        {/* More filters */}
      </div>

      <div className="jersey-grid">
        {jerseys.map(jersey => (
          <JerseyCard key={jersey.jersey_id} jersey={jersey} />
        ))}
      </div>

      <div className="pagination">
        <button
          disabled={filters.page === 1}
          onClick={() => handlePageChange(filters.page - 1)}
        >
          Previous
        </button>
        <span>Page {filters.page} of {Math.ceil(pagination.total / pagination.limit)}</span>
        <button
          disabled={filters.page >= Math.ceil(pagination.total / pagination.limit)}
          onClick={() => handlePageChange(filters.page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
};
```

### Jersey Detail Component

```javascript
import { useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchJerseyById } from '../store/slices/jerseysSlice';
import { addToCart } from '../store/slices/cartSlice';

export const JerseyDetail = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const { selectedJersey: jersey, loading, error } = useSelector(
    state => state.jerseys
  );

  useEffect(() => {
    dispatch(fetchJerseyById(id));
  }, [id, dispatch]);

  const handleAddToCart = () => {
    dispatch(addToCart(jersey));
    toast.success(`${jersey.name} added to cart!`);
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!jersey) return <div>Jersey not found</div>;

  return (
    <div className="jersey-detail">
      <h1>{jersey.name}</h1>
      <p>Club: {jersey.club_name}</p>
      <p>League: {jersey.league_name}</p>
      <p>Type: {jersey.jersey_type}</p>
      <p>Price: ${jersey.price_usd}</p>
      <p>Technology: {jersey.technology}</p>
      <p>Status: {jersey.in_stock ? 'In Stock' : 'Out of Stock'}</p>
      <button 
        onClick={handleAddToCart}
        disabled={!jersey.in_stock}
      >
        Add to Cart
      </button>
    </div>
  );
};
```

### Create Jersey Form (Admin)

```javascript
import { useForm } from 'react-hook-form';
import { useDispatch } from 'react-redux';
import { createJersey } from '../store/slices/jerseysSlice';

export const CreateJerseyForm = () => {
  const dispatch = useDispatch();
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError
  } = useForm({
    defaultValues: {
      club_id: null,
      league_id: null,
      product_code: '',
      season: '2024/25',
      jersey_type: 'home',
      name: '',
      price_usd: 120,
      technology: 'HEAT.RDY',
      in_stock: true,
      release_date: new Date().toISOString().split('T')[0]
    }
  });

  const onSubmit = async (data) => {
    // Convert price to number
    const jersey = { ...data, price_usd: parseFloat(data.price_usd) };
    
    try {
      const result = await dispatch(createJersey(jersey)).unwrap();
      toast.success('Jersey created!');
      navigate(`/jerseys/${result.jersey_id}`);
    } catch (error) {
      if (error.details) {
        error.details.forEach(({ field, message }) => {
          setError(field, { type: 'manual', message });
        });
      }
      toast.error(error.error || 'Creation failed');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input
        {...register('product_code', { required: 'Required' })}
        placeholder="AR6004"
      />
      {errors.product_code && <span>{errors.product_code.message}</span>}

      <input
        {...register('name', { required: 'Required' })}
        placeholder="Jersey name"
      />
      {errors.name && <span>{errors.name.message}</span>}

      <input
        {...register('price_usd', { required: 'Required', min: 1, max: 999 })}
        type="number"
        placeholder="120"
      />
      {errors.price_usd && <span>{errors.price_usd.message}</span>}

      <button type="submit">Create Jersey</button>
    </form>
  );
};
```

---

## 🌐 CORS & Environment

### Frontend .env.local

```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_APP_NAME=Adidas Jersey Store
VITE_API_TIMEOUT=10000
```

### Production .env

```env
VITE_API_BASE_URL=https://api.yourdomain.com
VITE_APP_NAME=Adidas Jersey Store
```

### CORS Note
Backend allows `origin: '*'` (all origins), so no CORS issues in development or production.

---

## 📦 Data Types Reference

```typescript
// League
type League = {
  league_id: number;
  league_name: string;
  short_code: string;
  country: string;
  confederation: 'UEFA' | 'CONMEBOL' | 'CONCACAF' | 'CAF' | 'AFC' | 'OFC';
  tier: number;
  adidas_partner: boolean;
  created_at: string; // ISO 8601
};

// Club
type Club = {
  club_id: number;
  league_id: number;
  club_name: string;
  short_name?: string;
  founded_year: number;
  city: string;
  country: string;
  primary_color: string; // Hex #XXXXXX
  secondary_color?: string;
  adidas_partner: boolean;
  created_at: string;
};

// Jersey
type Jersey = {
  jersey_id: number;
  club_id: number;
  league_id: number;
  product_code: string; // 5-20 chars
  season: string; // YYYY/YY
  jersey_type: 'home' | 'away' | 'third' | 'goalkeeper';
  name: string;
  price_usd: string; // Returned as string decimal
  technology?: string;
  in_stock: boolean;
  release_date?: string; // ISO date YYYY-MM-DD
  created_at: string;
  // Populated on detail endpoints
  club_name?: string;
  league_name?: string;
};

// Pagination
type Pagination = {
  page: number;
  limit: number;
  total: number;
};

// API Response
type ApiResponse<T> = {
  success: boolean;
  data?: T | T[];
  pagination?: Pagination;
  error?: string;
  details?: { field: string; message: string }[];
};
```

---

## ✅ Testing Checklist for Frontend

- [ ] GET /api/jerseys returns paginated list
- [ ] Filters (club_id, league_id, type, season, in_stock) work correctly
- [ ] Pagination navigation updates query params
- [ ] GET /api/jerseys/:id loads full jersey details
- [ ] POST /api/jerseys creates jersey with validation
- [ ] PUT /api/jerseys/:id updates jersey (partial)
- [ ] DELETE /api/jerseys/:id removes jersey
- [ ] Error responses show field-level validation errors
- [ ] 404 errors handled gracefully
- [ ] Loading states show during API calls
- [ ] Redux state updates after successful API call
- [ ] localStorage cart persists between page refreshes

---

**Backend is production-ready and awaiting frontend integration.**
