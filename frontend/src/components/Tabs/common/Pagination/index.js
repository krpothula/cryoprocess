import React from "react";
import { MdKeyboardDoubleArrowRight, MdOutlineKeyboardDoubleArrowLeft } from "react-icons/md";
import ReactPaginate from "react-paginate";

function Pagination({ pageCount, gotoPage }) {
  const handlePageClick = (event) => {
    gotoPage(event.selected);
  };

  return (
    <>
      <ReactPaginate
        nextLabel={<MdKeyboardDoubleArrowRight className="text-xl" />}
        onPageChange={handlePageClick}
        pageRangeDisplayed={5}
        marginPagesDisplayed={2}
        pageCount={pageCount}
        previousLabel={<MdOutlineKeyboardDoubleArrowLeft className="text-xl" />}
        breakLabel="..."
        renderOnZeroPageCount={null}
        // Container for pagination
        className="flex items-center mt-8 mb-4 justify-center gap-4 text-[var(--color-text-secondary)]"
        // Page item (inactive state)
        pageClassName="rounded-md px-3 py-1 hover:text-primary hover:font-medium transition-all"
        // Page link inside each page item
        pageLinkClassName=""
        // Previous button styling
        previousClassName="rounded px-3 py-1 hover:text-primary hover:bg-[var(--color-bg-hover)] transition-all"
        previousLinkClassName="text-[var(--color-text-secondary)] cursor-pointer"
        // Next button styling
        nextClassName="rounded-md px-3 py-1 hover:text-primary hover:bg-[var(--color-bg-hover)] transition-all"
        nextLinkClassName="text-[var(--color-text-secondary)] cursor-pointer"
        // Break indicator styling
        breakClassName="px-3 py-1 text-[var(--color-text-muted)]"
        breakLinkClassName="text-[var(--color-text-muted)]"
        // Active page styling
        activeClassName="text-primary font-bold rounded-md"
      />
    </>
  );
}

export default Pagination;
