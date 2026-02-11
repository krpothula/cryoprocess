const TextInput = ({ handleChange, type, ...props }) => {
  if (type === "textarea") {
    return (
      <textarea
        className="mt-1 block w-full p-2 px-4 border border-gray-300 rounded shadow-sm focus:ring-blue-500 focus:border-blue-500"
        {...props}
      ></textarea>
    );
  }

  return (
    <input
      type="text"
      onChange={handleChange}
      className="mt-1 block w-full p-3 px-4 border border-gray-300 rounded shadow-sm focus:ring-blue-500 focus:border-blue-500"
      {...props}
    />
  );
};

export default TextInput;
