export const formatDateString = (dateString) => {
  if (!dateString) {
    return "—";
  }

  try {
    const date = new Date(dateString.replace(" ", "T")); // Convert to ISO format

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return "—";
    }

    // Format the date
    const options = { day: "2-digit", month: "short", year: "numeric" };
    const formattedDate = date.toLocaleDateString("en-US", options);

    return formattedDate;
  } catch {
    return "—";
  }
};
