'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { SearchParams } from '@/services/attendance.service';

interface SearchBarProps {
  params: SearchParams;
}

export function SearchBar({ params }: SearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSearch = (formData: FormData) => {
    const newParams = new URLSearchParams(searchParams.toString());

    const search = formData.get('search') as string;
    const searchType = formData.get('searchType') as string;
    const fromDate = formData.get('fromDate') as string;
    const toDate = formData.get('toDate') as string;

    if (search) newParams.set('search', search);
    else newParams.delete('search');

    if (searchType) newParams.set('searchType', searchType);
    if (fromDate) newParams.set('fromDate', fromDate);
    if (toDate) newParams.set('toDate', toDate);

    newParams.set('page', '1');

    router.push(`?${newParams.toString()}`);
  };

  // Force re-render when params change so defaultValue updates
  const formKey = `${params.searchType}-${params.search}-${params.fromDate}-${params.toDate}`;

  return (
    <form key={formKey} action={handleSearch} className="search-bar no-print">
      <span className="text-muted fw-bold me-2">Search by:</span>

      {/* Search Type Dropdown */}
      <select
        name="searchType"
        className="form-select"
        style={{ width: '120px' }}
        defaultValue={params.searchType || 'name'}
      >
        <option value="name">Name</option>
        <option value="acc_no">AC-No.</option>
      </select>

      <input
        type="text"
        name="search"
        className="form-control search-input"
        placeholder="Enter search term..."
        defaultValue={params.search || ''}
      />

      <div className="date-range">
        <span className="text-muted">From</span>
        <input
          type="date"
          name="fromDate"
          className="form-control"
          defaultValue={params.fromDate || ''}
          aria-label="From date"
        />
        <span className="text-muted">To</span>
        <input
          type="date"
          name="toDate"
          className="form-control"
          defaultValue={params.toDate || ''}
          aria-label="To date"
        />
      </div>

      <button type="submit" className="btn btn-primary">
        <i className="fas fa-search"></i>
        Search
      </button>
    </form>
  );
}
