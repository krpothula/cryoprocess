import React from 'react'
import CustomInput from '../../common/Input'
import CustomDropdown from '../../common/Dropdown'

const MOVIE_STAGES = "Import";

const Movies = ({
    handleInputChange,
    formData,
    handleRangeChange,
    dropdownOptions,
  }) => {
    const movieEnable = formData.combineMovies === "Yes";

    const makeStarOnChange = (fieldName) => (val = "") => {
      handleInputChange({ target: { name: fieldName, value: val } });
    };

  return (
    <div className="tab-content">
    <CustomDropdown
      label="Combine movie STAR files?"
      options={dropdownOptions}
      value={formData.combineMovies}
      name="combineMovies"
      onChange={handleInputChange}
      tooltipText="Enable combining movie STAR files from multiple Import jobs into a single file."
    />

    <CustomInput
      stageStarFiles={MOVIE_STAGES}
      onChange={makeStarOnChange("movieStarFile1")}
      name="movieStarFile1"
      label="Movie STAR file 1:"
      placeholder="Select movie STAR file"
      tooltipText="First movie STAR file to combine. Select from Import jobs."
      disabled={!movieEnable}
      value={formData.movieStarFile1}
    />
    <CustomInput
      stageStarFiles={MOVIE_STAGES}
      onChange={makeStarOnChange("movieStarFile2")}
      name="movieStarFile2"
      label="Movie STAR file 2:"
      placeholder="Select movie STAR file"
      tooltipText="Second movie STAR file to combine."
      disabled={!movieEnable}
      value={formData.movieStarFile2}
    />
    <CustomInput
      stageStarFiles={MOVIE_STAGES}
      onChange={makeStarOnChange("movieStarFile3")}
      name="movieStarFile3"
      label="Movie STAR file 3:"
      placeholder="Select movie STAR file"
      tooltipText="Third movie STAR file to combine (optional)."
      disabled={!movieEnable}
      value={formData.movieStarFile3}
    />
    <CustomInput
      stageStarFiles={MOVIE_STAGES}
      onChange={makeStarOnChange("movieStarFile4")}
      name="movieStarFile4"
      label="Movie STAR file 4:"
      placeholder="Select movie STAR file"
      tooltipText="Fourth movie STAR file to combine (optional)."
      disabled={!movieEnable}
      value={formData.movieStarFile4}
    />
  </div>
  )
}

export default Movies
