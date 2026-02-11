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
        className="flex items-center mt-8 mb-4 justify-center gap-4 text-gray-500"
        // Page item (inactive state)
        pageClassName="rounded-md px-3 py-1 hover:text-primary hover:font-medium transition-all"
        // Page link inside each page item
        pageLinkClassName=""
        // Previous button styling
        previousClassName="rounded px-3 py-1 hover:text-primary hover:bg-gray-100 transition-all"
        previousLinkClassName="text-gray-500 cursor-pointer"
        // Next button styling
        nextClassName="rounded-md px-3 py-1 hover:text-primary hover:bg-gray-100 transition-all"
        nextLinkClassName="text-gray-500 cursor-pointer"
        // Break indicator styling
        breakClassName="px-3 py-1 text-gray-400"
        breakLinkClassName="text-gray-400"
        // Active page styling
        activeClassName="text-primary font-bold rounded-md"
      />
    </>
  );
}

export default Pagination;
