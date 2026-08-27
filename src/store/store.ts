import { configureStore } from '@reduxjs/toolkit';
import filtersReducer from './filtersSlice';
import dbReducer from './dbSlice';

export const store = configureStore({
  reducer: {
    filters: filtersReducer,
    db: dbReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
