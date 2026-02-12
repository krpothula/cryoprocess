const TextInput = ({ handleChange, type, ...props }) => {
  if (type === "textarea") {
    return (
      <textarea
        className="mt-1 block w-full p-2 px-4 border border-[var(--color-border)] rounded shadow-sm focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
        {...props}
      ></textarea>
    );
  }

  return (
    <input
      type="text"
      onChange={handleChange}
      className="mt-1 block w-full p-3 px-4 border border-[var(--color-border)] rounded shadow-sm focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
      {...props}
    />
  );
};

export default TextInput;
